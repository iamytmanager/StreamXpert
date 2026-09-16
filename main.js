const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const axios = require('axios');

// Chromium RDP / Low Resource Performance Optimizations
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-gpu-sandbox');

let mainWindow = null;
const activeStreams = new Map(); // id -> { process, config, metrics, startTime, reconnectTimeout, retries }
let statsInterval = null;

function getConfigPath() {
  try {
    return path.join(app.getPath('userData'), 'streamxpert_config.json');
  } catch (err) {
    return path.join(__dirname, 'streamxpert_config.json');
  }
}

function loadSavedConfig() {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
  return {
    streamMode: 'copy', // 'copy' = Passthrough (~0% CPU), 'reencode' = Software x264
    rdpMode: true,
    youtubeKey: '',
    facebookKey: '',
    tiktokServer: 'rtmp://live-push.tiktok-live.com/live/',
    tiktokKey: '',
    customRtmpUrl: '',
    bitrate: '3000k',
    preset: 'ultrafast',
    fps: '30',
    resolution: 'original',
    audioBitrate: '128k',
    infiniteLoop: true,
    autoReconnect: true,
    reconnectDelay: 5,
    maxRetries: 10,
    updateGistUrl: ''
  };
}

function saveUserConfig(cfg) {
  try {
    const p = getConfigPath();
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    console.error('Failed to save config:', err);
    return { success: false, error: err.message };
  }
}

// System Resources Monitoring
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();

function calculateSystemStats() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);

  // App Process CPU calculation
  const currentUsage = process.cpuUsage(lastCpuUsage);
  const currentTime = Date.now();
  const timeDiff = (currentTime - lastCpuTime) * 1000; // microseconds
  lastCpuUsage = process.cpuUsage();
  lastCpuTime = currentTime;

  const appCpu = timeDiff > 0 ? Math.min(100, Math.round(((currentUsage.user + currentUsage.system) / (timeDiff * cpus.length)) * 100)) : 0;

  return {
    cpuPercent: appCpu,
    memoryPercent: memPercent,
    usedMemoryMB: Math.round(usedMem / (1024 * 1024)),
    totalMemoryMB: Math.round(totalMem / (1024 * 1024)),
    activeStreamsCount: activeStreams.size
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 650,
    backgroundColor: '#07090e',
    frame: false,
    titleBarStyle: 'hidden',
    title: 'StreamXpert 2.0 Studio by Shahzaib Jutt',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Start continuous system stats broadcast (Optimized interval for RDP)
  statsInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:stats-update', calculateSystemStats());
    }
  }, 2500);

  mainWindow.on('closed', () => {
    // Terminate all streaming child processes
    for (const [id, stream] of activeStreams.entries()) {
      stopStreamProcess(id);
    }
    clearInterval(statsInterval);
    mainWindow = null;
  });
}

// FFmpeg Command Builder
function buildFFmpegArgs(config) {
  const args = [];

  // Infinite loop & real-time flag
  if (config.infiniteLoop) {
    args.push('-stream_loop', '-1');
  }
  args.push('-re');

  // Input file
  args.push('-i', config.filePath);

  // STREAM MODE: PASSTHROUGH (0% CPU) vs RE-ENCODE
  if (config.streamMode === 'copy') {
    // Ultra-Low CPU Passthrough: Copies video frames directly without decoding/re-encoding!
    // Consumes < 0.5% CPU per stream, allowing 10-20+ concurrent streams on 4-core RDP!
    args.push('-c:v', 'copy');
    args.push('-c:a', 'aac', '-b:a', config.audioBitrate || '128k', '-ar', '44100');
  } else {
    // Video Codec & Encoding params
    args.push('-c:v', 'libx264');

    // Thread limitation to avoid choking 4-core RDP CPUs
    const threadCount = config.threads || (config.rdpMode ? '1' : '2');
    args.push('-threads', threadCount.toString());

    args.push('-preset', config.preset || (config.rdpMode ? 'ultrafast' : 'veryfast'));
    args.push('-tune', 'zerolatency');

    const bitrate = config.bitrate ? config.bitrate.toString().replace(/[^0-9kKmM]/g, '') : '3000k';
    args.push('-b:v', bitrate);
    args.push('-minrate', bitrate);
    args.push('-maxrate', bitrate);

    // Compute buffer size (approx 2x bitrate)
    const numVal = parseInt(bitrate, 10) || 3000;
    const unit = bitrate.toLowerCase().includes('m') ? 'M' : 'k';
    args.push('-bufsize', `${numVal * 2}${unit}`);

    args.push('-pix_fmt', 'yuv420p');
    const fps = config.fps || '30';
    args.push('-r', fps);
    args.push('-g', `${parseInt(fps, 10) * 2}`); // 2 second GOP

    // Resolution filtering (portrait for TikTok, landscape, or original)
    if (config.resolution === 'portrait-1080x1920') {
      args.push('-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2');
    } else if (config.resolution === 'portrait-720x1280') {
      args.push('-vf', 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2');
    } else if (config.resolution === '1080p') {
      args.push('-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2');
    } else if (config.resolution === '720p') {
      args.push('-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2');
    }

    // Audio settings
    args.push('-c:a', 'aac');
    args.push('-b:a', config.audioBitrate || '128k');
    args.push('-ar', '44100');
  }

  args.push('-map', '0');

  // Collect target RTMP endpoints
  const targets = [];
  if (config.youtubeEnabled && config.youtubeKey && config.youtubeKey.trim()) {
    targets.push(`rtmps://a.rtmps.youtube.com/live2/${config.youtubeKey.trim()}`);
  }
  if (config.facebookEnabled && config.facebookKey && config.facebookKey.trim()) {
    targets.push(`rtmps://live-api-s.facebook.com:443/rtmp/${config.facebookKey.trim()}`);
  }
  if (config.tiktokEnabled && config.tiktokKey && config.tiktokKey.trim()) {
    const server = (config.tiktokServer && config.tiktokServer.trim()) || 'rtmp://live-push.tiktok-live.com/live/';
    const base = server.endsWith('/') ? server : server + '/';
    targets.push(`${base}${config.tiktokKey.trim()}`);
  }
  if (config.customEnabled && config.customRtmpUrl && config.customRtmpUrl.trim()) {
    targets.push(config.customRtmpUrl.trim());
  }

  if (targets.length === 0) {
    throw new Error('No destination stream keys or RTMP URLs provided!');
  }

  if (targets.length === 1) {
    args.push('-f', 'flv', targets[0]);
  } else {
    // Multi-destination broadcasting using tee muxer
    const teeString = targets.map(url => `[f=flv:onfail=ignore]${url}`).join('|');
    args.push('-f', 'tee', teeString);
  }

  return args;
}

// Parse FFmpeg stderr for live telemetry
function parseFFmpegMetrics(line) {
  // Typical line: frame=  123 fps= 30.0 q=24.0 size=    1234kB time=00:00:04.12 bitrate=2450.3kbits/s speed=0.998x drop=0
  const metrics = {};
  const frameMatch = line.match(/frame=\s*(\d+)/);
  const fpsMatch = line.match(/fps=\s*([\d.]+)/);
  const bitrateMatch = line.match(/bitrate=\s*([\d.]+\s*\w+\/s)/);
  const speedMatch = line.match(/speed=\s*([\d.]+x)/);
  const timeMatch = line.match(/time=\s*([\d:.]+)/);
  const dropMatch = line.match(/drop=\s*(\d+)/);

  if (frameMatch) metrics.frame = frameMatch[1];
  if (fpsMatch) metrics.fps = fpsMatch[1];
  if (bitrateMatch) metrics.bitrate = bitrateMatch[1];
  if (speedMatch) metrics.speed = speedMatch[1];
  if (timeMatch) metrics.time = timeMatch[1];
  if (dropMatch) metrics.drop = dropMatch[1];

  return Object.keys(metrics).length > 0 ? metrics : null;
}

function startStreamProcess(streamId, config) {
  try {
    const args = buildFFmpegArgs(config);
    const ffmpegPath = config.customFfmpegPath && config.customFfmpegPath.trim() 
      ? config.customFfmpegPath.trim() 
      : 'ffmpeg';

    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Lower process priority on Windows so FFmpeg never starves RDP or other streams
    try {
      if (child.pid && os.constants && os.constants.priority) {
        os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
      }
    } catch (priorityErr) {
      // Ignored if permissions don't allow
    }

    const streamObj = {
      id: streamId,
      process: child,
      config,
      startTime: Date.now(),
      retries: (activeStreams.get(streamId)?.retries || 0),
      status: 'active'
    };
    activeStreams.set(streamId, streamObj);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('stream:status', { streamId, status: 'live', message: 'Stream started successfully' });
      mainWindow.webContents.send('stream:log', { streamId, text: `[StreamXpert] FFmpeg process started with PID ${child.pid}` });
    }

    child.stdout.on('data', (data) => {
      const line = data.toString();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream:log', { streamId, text: line });
      }
    });

    child.stderr.on('data', (data) => {
      const line = data.toString();
      const metrics = parseFFmpegMetrics(line);
      if (metrics && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream:progress', { streamId, metrics });
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream:log', { streamId, text: line });
      }
    });

    child.on('error', (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream:status', { streamId, status: 'error', message: `Process error: ${err.message}` });
        mainWindow.webContents.send('stream:log', { streamId, text: `[StreamXpert ERROR] ${err.message}` });
      }
    });

    child.on('exit', (code, signal) => {
      const current = activeStreams.get(streamId);
      const isManualStop = current?.stoppingManual;

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stream:log', { streamId, text: `[StreamXpert] FFmpeg exited with code ${code} (signal: ${signal})` });
      }

      if (!isManualStop && config.autoReconnect && (current?.retries || 0) < (config.maxRetries || 10)) {
        const nextRetry = (current?.retries || 0) + 1;
        const delay = config.reconnectDelay || 5;

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('stream:status', { 
            streamId, 
            status: 'reconnecting', 
            message: `Stream dropped. Reconnecting in ${delay}s (Attempt ${nextRetry}/${config.maxRetries || 10})...` 
          });
        }

        const timeout = setTimeout(() => {
          if (activeStreams.has(streamId)) {
            const entry = activeStreams.get(streamId);
            entry.retries = nextRetry;
            startStreamProcess(streamId, config);
          }
        }, delay * 1000);

        if (current) current.reconnectTimeout = timeout;
      } else {
        activeStreams.delete(streamId);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('stream:status', { 
            streamId, 
            status: 'stopped', 
            message: isManualStop ? 'Stream stopped by user' : 'Stream ended' 
          });
        }
      }
    });

    return { success: true, streamId };
  } catch (err) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('stream:status', { streamId, status: 'error', message: err.message });
    }
    return { success: false, error: err.message };
  }
}

function stopStreamProcess(streamId) {
  const stream = activeStreams.get(streamId);
  if (!stream) return { success: false, error: 'Stream not found' };

  stream.stoppingManual = true;
  if (stream.reconnectTimeout) {
    clearTimeout(stream.reconnectTimeout);
  }

  if (stream.process) {
    try {
      // Windows graceful kill via taskkill tree
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', stream.process.pid, '/f', '/t']);
      } else {
        stream.process.kill('SIGTERM');
      }
    } catch (err) {
      console.error('Error killing process:', err);
    }
  }

  activeStreams.delete(streamId);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stream:status', { streamId, status: 'stopped', message: 'Stream stopped' });
  }
  return { success: true };
}

// IPC Handlers
ipcMain.handle('dialog:select-video', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Video for Live Stream',
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mkv', 'flv', 'mov', 'avi', 'ts', 'webm', 'wmv'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const stats = fs.statSync(filePath);
  return {
    filePath,
    fileName: path.basename(filePath),
    fileSizeMB: (stats.size / (1024 * 1024)).toFixed(2)
  };
});

ipcMain.handle('stream:start', async (event, config) => {
  const streamId = config.id || 'stream-main';
  return startStreamProcess(streamId, config);
});

ipcMain.handle('stream:stop', async (event, streamId) => {
  return stopStreamProcess(streamId || 'stream-main');
});

ipcMain.handle('stream:get-all', () => {
  const list = [];
  for (const [id, s] of activeStreams.entries()) {
    list.push({ id, status: s.status, retries: s.retries, startTime: s.startTime });
  }
  return list;
});

ipcMain.handle('system:get-stats', () => {
  return calculateSystemStats();
});

ipcMain.handle('config:load', () => {
  return loadSavedConfig();
});

ipcMain.handle('config:save', (event, cfg) => {
  return saveUserConfig(cfg);
});

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

// ── 🌐 CLOUD AUTO-UPDATER & VERSION CONTROL ─────────────────────────────
const DEFAULT_UPDATE_GIST = 'https://gist.githubusercontent.com/iamytmanager/df3b587b65e1450b3a44d29bbd971251/raw/app_status.json';

ipcMain.handle('app:get-version', async () => {
  return app.getVersion();
});

ipcMain.handle('app:open-external', async (event, targetUrl) => {
  try {
    if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
      await shell.openExternal(targetUrl);
      return { success: true };
    }
  } catch (e) {
    console.warn('[app:open-external error]:', e.message);
  }
  return { success: false, error: 'Invalid URL.' };
});

ipcMain.handle('app:check-update', async (event, customGistUrl) => {
  try {
    const config = loadSavedConfig();
    const gistUrl = customGistUrl || config.updateGistUrl || DEFAULT_UPDATE_GIST;
    const urlWithCacheBuster = gistUrl.includes('?') 
      ? `${gistUrl}&t=${Date.now()}` 
      : `${gistUrl}?t=${Date.now()}`;

    const res = await axios.get(urlWithCacheBuster, { timeout: 8000 });
    const remote = res.data || {};

    const latestVer = String(remote.latest_version || remote.version || '2.0.0').replace(/^v/i, '').trim();
    const currentVer = String(app.getVersion() || '2.0.0').replace(/^v/i, '').trim();

    const isNewer = (vLatest, vCurrent) => {
      const pLatest = vLatest.split('.').map(n => parseInt(n, 10) || 0);
      const pCurrent = vCurrent.split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < Math.max(pLatest.length, pCurrent.length); i++) {
        const l = pLatest[i] || 0;
        const c = pCurrent[i] || 0;
        if (l > c) return true;
        if (l < c) return false;
      }
      return false;
    };

    const hasUpdate = isNewer(latestVer, currentVer);

    return {
      success: true,
      hasUpdate,
      latestVersion: latestVer,
      currentVersion: currentVer,
      downloadUrl: remote.download_url || '',
      changelog: remote.release_notes || remote.changelog || 'Performance optimizations and bug fixes.',
      mandatory: !!remote.force_update
    };
  } catch (err) {
    console.warn('[AutoUpdater check error]:', err.message);
    return {
      success: false,
      hasUpdate: false,
      currentVersion: app.getVersion(),
      error: err.message
    };
  }
});

ipcMain.handle('app:download-update', async (event, updateInfo) => {
  if (!updateInfo?.downloadUrl) {
    return { success: false, error: 'No download URL provided.' };
  }

  const tempDir = app.getPath('temp');
  const installerName = `StreamXpert_Setup_v${updateInfo.latestVersion || 'latest'}.exe`;
  const installerPath = path.join(tempDir, installerName);

  try {
    const response = await axios({
      method: 'GET',
      url: updateInfo.downloadUrl,
      responseType: 'stream',
      timeout: 180000
    });

    const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
    let receivedBytes = 0;
    let lastEmitTime = Date.now();
    let lastReceived = 0;

    const writer = fs.createWriteStream(installerPath);

    response.data.on('data', (chunk) => {
      receivedBytes += chunk.length;
      const now = Date.now();

      if (now - lastEmitTime > 150 || receivedBytes === totalBytes) {
        const percent = totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0;
        const receivedMB = (receivedBytes / (1024 * 1024)).toFixed(1);
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
        const speedMBps = (((receivedBytes - lastReceived) / (1024 * 1024)) / ((now - lastEmitTime) / 1000)).toFixed(1);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:update-progress', {
            percent,
            receivedMB,
            totalMB,
            speedMBps: isNaN(speedMBps) ? '2.0' : speedMBps
          });
        }

        lastEmitTime = now;
        lastReceived = receivedBytes;
      }
    });

    return new Promise((resolve) => {
      writer.on('finish', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:update-progress', {
            percent: 100,
            receivedMB: (receivedBytes / (1024 * 1024)).toFixed(1),
            totalMB: (totalBytes / (1024 * 1024)).toFixed(1),
            completed: true
          });
        }

        setTimeout(() => {
          try {
            spawn(installerPath, ['/SILENT', '/S'], { detached: true, stdio: 'ignore' }).unref();
            app.quit();
            resolve({ success: true });
          } catch (spawnErr) {
            console.error('Failed to spawn installer:', spawnErr);
            resolve({ success: false, error: spawnErr.message });
          }
        }, 1200);
      });

      writer.on('error', (err) => {
        console.error('Download stream write error:', err);
        resolve({ success: false, error: err.message });
      });

      response.data.pipe(writer);
    });
  } catch (err) {
    console.error('Download error:', err.message);
    return { success: false, error: err.message };
  }
});

// App Lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
