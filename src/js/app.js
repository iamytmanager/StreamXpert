// StreamXpert 2.0 Pro Studio Renderer App Logic
document.addEventListener('DOMContentLoaded', async () => {
  // Global State
  let currentFile = null;
  let isStreaming = false;
  let streamStartTime = null;
  let durationInterval = null;
  let scheduleTimer = null;
  let targetScheduleDate = null;
  let multiStreamCount = 0;

  // Window Controls
  const btnWinMin = document.getElementById('win-min');
  const btnWinMax = document.getElementById('win-max');
  const btnWinClose = document.getElementById('win-close');

  if (btnWinMin) btnWinMin.addEventListener('click', () => window.api.minimizeWindow());
  if (btnWinMax) btnWinMax.addEventListener('click', () => window.api.maximizeWindow());
  if (btnWinClose) {
    btnWinClose.addEventListener('click', () => {
      if (window.api && typeof window.api.closeWindow === 'function') {
        window.api.closeWindow();
      } else {
        window.close();
      }
    });
  }

  // Navigation Items & Tab Views
  const navItems = document.querySelectorAll('.nav-item');
  const tabViews = document.querySelectorAll('.tab-view');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      tabViews.forEach(v => v.classList.remove('active'));
      item.classList.add('active');
      const targetId = item.getAttribute('data-tab');
      const view = document.getElementById(targetId);
      if (view) view.classList.add('active');
    });
  });

  // 0. Theme Switcher Logic (Instant Palette Changing)
  const themeSelector = document.getElementById('theme-selector');
  function applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    try { localStorage.setItem('streamxpert_theme', themeName); } catch (e) {}
    if (themeSelector) themeSelector.value = themeName;
  }

  let savedTheme = 'mint';
  try { savedTheme = localStorage.getItem('streamxpert_theme') || 'mint'; } catch (e) {}
  applyTheme(savedTheme);

  if (themeSelector) {
    themeSelector.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });
  }

  // Top Titlebar HUD
  const statCpu = document.getElementById('stat-cpu');
  const statRam = document.getElementById('stat-ram');
  const statActive = document.getElementById('stat-active');
  const statusPillHud = document.getElementById('status-pill-hud');
  const statusTextHud = document.getElementById('status-text-hud');
  const statusLiveTag = document.getElementById('status-live-tag');

  // Video Selector Elements
  const dropzone = document.getElementById('video-dropzone');
  const fileCard = document.getElementById('file-card');
  const fileNameTxt = document.getElementById('file-name-txt');
  const fileDetailsTxt = document.getElementById('file-details-txt');
  const btnRemoveFile = document.getElementById('btn-remove-file');
  const fileBadge = document.getElementById('file-badge');

  // Destination Elements & Toggles
  const enableYt = document.getElementById('enable-yt');
  const keyYt = document.getElementById('key-yt');
  const enableFb = document.getElementById('enable-fb');
  const keyFb = document.getElementById('key-fb');
  const enableTt = document.getElementById('enable-tt');
  const serverTt = document.getElementById('server-tt');
  const keyTt = document.getElementById('key-tt');
  const enableCustom = document.getElementById('enable-custom');
  const urlCustom = document.getElementById('url-custom');

  const platformToggles = [
    { toggle: enableYt, row: document.getElementById('row-yt'), activeClass: 'active-yt' },
    { toggle: enableFb, row: document.getElementById('row-fb'), activeClass: 'active-fb' },
    { toggle: enableTt, row: document.getElementById('row-tt'), activeClass: 'active-tt' },
    { toggle: enableCustom, row: document.getElementById('row-custom'), activeClass: 'active-custom' }
  ];

  platformToggles.forEach(({ toggle, row, activeClass }) => {
    if (!toggle || !row) return;
    const updateState = () => {
      if (toggle.checked) row.classList.add(activeClass);
      else row.classList.remove(activeClass);
    };
    toggle.addEventListener('change', updateState);
    updateState();
  });

  // Encoding Settings
  const cfgBitrate = document.getElementById('cfg-bitrate');
  const cfgResolution = document.getElementById('cfg-resolution');
  const cfgPreset = document.getElementById('cfg-preset');
  const cfgFps = document.getElementById('cfg-fps');
  const cfgAudioBitrate = document.getElementById('cfg-audio-bitrate');
  const cfgCustomFfmpeg = document.getElementById('cfg-custom-ffmpeg');
  const cfgInfiniteLoop = document.getElementById('cfg-infinite-loop');
  const cfgAutoReconnect = document.getElementById('cfg-auto-reconnect');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // Telemetry Gauges
  const metricDuration = document.getElementById('metric-duration');
  const metricBitrate = document.getElementById('metric-bitrate');
  const metricFps = document.getElementById('metric-fps');
  const metricSpeed = document.getElementById('metric-speed');
  const metricFrames = document.getElementById('metric-frames');
  const metricDrops = document.getElementById('metric-drops');
  const healthBadge = document.getElementById('health-badge');

  // Terminal Console
  const logTerminal = document.getElementById('log-terminal');
  const btnCopyLog = document.getElementById('btn-copy-log');
  const btnClearLog = document.getElementById('btn-clear-log');

  // Action Buttons
  const btnStartStream = document.getElementById('btn-start-stream');
  const btnStopStream = document.getElementById('btn-stop-stream');

  // Scheduler Elements
  const scheduleDatetime = document.getElementById('schedule-datetime');
  const btnSetSchedule = document.getElementById('btn-set-schedule');
  const btnCancelSchedule = document.getElementById('btn-cancel-schedule');
  const countdownContainer = document.getElementById('countdown-container');
  const countdownDisplay = document.getElementById('countdown-display');
  const scheduleTargetText = document.getElementById('schedule-target-text');
  const scheduleBadge = document.getElementById('schedule-badge');

  // Multi-Stream Container
  const btnAddMultiChannel = document.getElementById('btn-add-multi-channel');
  const multiStreamContainer = document.getElementById('multi-stream-container');

  // Cloud Auto-Updater Elements
  const updateModal = document.getElementById('update-modal');
  const updateCurrentVer = document.getElementById('update-current-ver');
  const updateLatestVer = document.getElementById('update-latest-ver');
  const updateChangelogTxt = document.getElementById('update-changelog-txt');
  const updateProgressDeck = document.getElementById('update-progress-deck');
  const updateProgressBar = document.getElementById('update-progress-bar');
  const updateProgressPct = document.getElementById('update-progress-pct');
  const updateProgressBytes = document.getElementById('update-progress-bytes');
  const updateProgressSpeed = document.getElementById('update-progress-speed');
  const updateProgressStatus = document.getElementById('update-progress-status');
  const updateModalActions = document.getElementById('update-modal-actions');
  const btnCloseUpdateModal = document.getElementById('btn-close-update-modal');
  const btnRemindLater = document.getElementById('btn-remind-later');
  const btnStartDownloadUpdate = document.getElementById('btn-start-download-update');
  const btnManualCheckUpdate = document.getElementById('btn-manual-check-update');
  const cfgUpdateGist = document.getElementById('cfg-update-gist');
  const appVersionTxt = document.getElementById('app-version-txt');

  let activeUpdateInfo = null;

  // Set installed version
  try {
    const v = await window.api.getAppVersion();
    if (v && appVersionTxt) appVersionTxt.textContent = `v${v}`;
    if (v && updateCurrentVer) updateCurrentVer.textContent = `v${v}`;
  } catch (e) {}

  // 1. Load Saved Configuration
  try {
    const savedConfig = await window.api.loadConfig();
    if (savedConfig) {
      if (savedConfig.youtubeKey) keyYt.value = savedConfig.youtubeKey;
      if (savedConfig.facebookKey) keyFb.value = savedConfig.facebookKey;
      if (savedConfig.tiktokServer) serverTt.value = savedConfig.tiktokServer;
      if (savedConfig.tiktokKey) keyTt.value = savedConfig.tiktokKey;
      if (savedConfig.customRtmpUrl) urlCustom.value = savedConfig.customRtmpUrl;
      if (savedConfig.bitrate) cfgBitrate.value = savedConfig.bitrate;
      if (savedConfig.preset) cfgPreset.value = savedConfig.preset;
      if (savedConfig.fps) cfgFps.value = savedConfig.fps;
      if (savedConfig.resolution) cfgResolution.value = savedConfig.resolution;
      if (savedConfig.audioBitrate) cfgAudioBitrate.value = savedConfig.audioBitrate;
      if (savedConfig.customFfmpegPath) cfgCustomFfmpeg.value = savedConfig.customFfmpegPath;
      if (savedConfig.updateGistUrl && cfgUpdateGist) cfgUpdateGist.value = savedConfig.updateGistUrl;
      if (typeof savedConfig.infiniteLoop === 'boolean') cfgInfiniteLoop.checked = savedConfig.infiniteLoop;
      if (typeof savedConfig.autoReconnect === 'boolean') cfgAutoReconnect.checked = savedConfig.autoReconnect;
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }

  // 2. Save Settings Button
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      const cfg = {
        youtubeKey: keyYt.value.trim(),
        facebookKey: keyFb.value.trim(),
        tiktokServer: serverTt.value.trim(),
        tiktokKey: keyTt.value.trim(),
        customRtmpUrl: urlCustom.value.trim(),
        bitrate: cfgBitrate.value,
        preset: cfgPreset.value,
        fps: cfgFps.value,
        resolution: cfgResolution.value,
        audioBitrate: cfgAudioBitrate.value,
        customFfmpegPath: cfgCustomFfmpeg.value.trim(),
        updateGistUrl: cfgUpdateGist ? cfgUpdateGist.value.trim() : '',
        infiniteLoop: cfgInfiniteLoop.checked,
        autoReconnect: cfgAutoReconnect.checked
      };
      const res = await window.api.saveConfig(cfg);
      if (res?.success) {
        appendLog('✅ Preferences saved successfully.');
        btnSaveSettings.textContent = 'Configuration Saved!';
        setTimeout(() => { btnSaveSettings.textContent = 'Save Studio Configuration'; }, 1800);
      }
    });
  }

  // 2.1 Auto-Updater Modal & Check Actions
  function showUpdateModal(info) {
    activeUpdateInfo = info;
    if (updateCurrentVer) updateCurrentVer.textContent = `v${info.currentVersion}`;
    if (updateLatestVer) updateLatestVer.textContent = `v${info.latestVersion}`;
    if (updateChangelogTxt) updateChangelogTxt.textContent = info.changelog || 'Performance enhancements and bug fixes.';
    if (updateProgressDeck) updateProgressDeck.style.display = 'none';
    if (updateModalActions) updateModalActions.style.display = 'flex';
    if (updateModal) updateModal.style.display = 'flex';
  }

  function hideUpdateModal() {
    if (updateModal) updateModal.style.display = 'none';
  }

  if (btnCloseUpdateModal) btnCloseUpdateModal.addEventListener('click', hideUpdateModal);
  if (btnRemindLater) btnRemindLater.addEventListener('click', hideUpdateModal);

  async function checkUpdates(isManual = false) {
    try {
      const customGist = cfgUpdateGist ? cfgUpdateGist.value.trim() : '';
      if (isManual && btnManualCheckUpdate) {
        btnManualCheckUpdate.textContent = 'Checking...';
      }
      const res = await window.api.checkAppUpdate(customGist);
      if (res && res.success && res.hasUpdate) {
        showUpdateModal(res);
      } else if (isManual) {
        alert(res?.error ? `Update check failed: ${res.error}` : `You are on the latest version (v${res?.currentVersion || '2.0.0'}).`);
      }
    } catch (err) {
      if (isManual) alert('Error checking for updates: ' + err.message);
    } finally {
      if (isManual && btnManualCheckUpdate) {
        btnManualCheckUpdate.innerHTML = '<span>🔄</span> Check for Updates Now';
      }
    }
  }

  // Non-blocking background check 3.5s after launch
  setTimeout(() => {
    checkUpdates(false);
  }, 3500);

  if (btnManualCheckUpdate) {
    btnManualCheckUpdate.addEventListener('click', () => checkUpdates(true));
  }

  // Trigger Download & Silent NSIS Upgrade
  if (btnStartDownloadUpdate) {
    btnStartDownloadUpdate.addEventListener('click', async () => {
      if (!activeUpdateInfo?.downloadUrl) return;
      if (updateModalActions) updateModalActions.style.display = 'none';
      if (updateProgressDeck) updateProgressDeck.style.display = 'flex';
      if (updateProgressBar) updateProgressBar.style.width = '0%';
      if (updateProgressPct) updateProgressPct.textContent = '0%';
      if (updateProgressStatus) updateProgressStatus.textContent = 'Downloading installer package...';

      const res = await window.api.downloadAppUpdate(activeUpdateInfo);
      if (!res?.success) {
        alert('Failed to download update: ' + (res?.error || 'Unknown error'));
        if (updateModalActions) updateModalActions.style.display = 'flex';
        if (updateProgressDeck) updateProgressDeck.style.display = 'none';
      }
    });
  }

  // Real-time Update Download Progress Listener
  if (window.api.onUpdateProgress) {
    window.api.onUpdateProgress((data) => {
      if (updateProgressBar) updateProgressBar.style.width = `${data.percent}%`;
      if (updateProgressPct) updateProgressPct.textContent = `${data.percent}%`;
      if (updateProgressBytes) updateProgressBytes.textContent = `${data.receivedMB} MB / ${data.totalMB || '...'} MB`;
      if (updateProgressSpeed) updateProgressSpeed.textContent = `${data.speedMBps || '2.0'} MB/s`;
      if (data.completed && updateProgressStatus) {
        updateProgressStatus.textContent = '✅ Download Complete! Installing & Restarting...';
        updateProgressStatus.style.color = '#10b981';
      }
    });
  }

  // 3. Video File Drag & Drop & Selector
  function setVideoFile(file) {
    currentFile = file;
    if (file) {
      fileNameTxt.textContent = file.fileName;
      fileDetailsTxt.textContent = `${file.fileSizeMB} MB • READY FOR BROADCAST`;
      fileCard.style.display = 'flex';
      dropzone.style.display = 'none';
      fileBadge.textContent = 'READY';
      fileBadge.style.color = '#6ee7b7';
      fileBadge.style.borderColor = 'rgba(110, 231, 183, 0.4)';
      appendLog(`[File Ready] ${file.fileName} (${file.fileSizeMB} MB)`);
    } else {
      fileCard.style.display = 'none';
      dropzone.style.display = 'block';
      fileBadge.textContent = 'REQUIRED';
      fileBadge.style.color = '#a5b4fc';
      fileBadge.style.borderColor = 'rgba(99, 102, 241, 0.4)';
    }
  }

  dropzone.addEventListener('click', async () => {
    const selected = await window.api.selectVideo();
    if (selected) setVideoFile(selected);
  });

  btnRemoveFile.addEventListener('click', () => setVideoFile(null));

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const f = e.dataTransfer.files[0];
      const validExts = ['.mp4', '.mkv', '.flv', '.mov', '.avi', '.ts', '.webm', '.wmv'];
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();

      if (validExts.includes(ext)) {
        setVideoFile({
          filePath: f.path,
          fileName: f.name,
          fileSizeMB: (f.size / (1024 * 1024)).toFixed(2)
        });
      } else {
        alert('Invalid format. Please drop a valid video file (.mp4, .mkv, .mov, etc.)');
      }
    }
  });

  // RDP Eco Mode State (Default: ON for maximum RDP speed & 0% GPU overhead)
  const hudRdpChip = document.getElementById('hud-rdp-chip');
  const rdpStatusTxt = document.getElementById('rdp-status-txt');
  let isRdpMode = true;

  function setRdpMode(enabled) {
    isRdpMode = enabled;
    if (enabled) {
      document.body.classList.add('rdp-eco-mode');
      if (rdpStatusTxt) rdpStatusTxt.textContent = 'RDP ECO: ON';
      if (hudRdpChip) {
        hudRdpChip.style.borderColor = 'rgba(245, 158, 11, 0.5)';
        hudRdpChip.style.background = 'rgba(245, 158, 11, 0.15)';
      }
    } else {
      document.body.classList.remove('rdp-eco-mode');
      if (rdpStatusTxt) rdpStatusTxt.textContent = 'RDP ECO: OFF';
      if (hudRdpChip) {
        hudRdpChip.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        hudRdpChip.style.background = 'rgba(255, 255, 255, 0.03)';
      }
    }
  }

  // Initialize RDP Eco Mode
  setRdpMode(true);

  if (hudRdpChip) {
    hudRdpChip.addEventListener('click', () => {
      setRdpMode(!isRdpMode);
    });
  }

  // Throttled Log Buffer (Flushes at most 3 times/sec to prevent DOM reflows & CPU lag)
  let logBuffer = [];
  let logFlushTimer = null;

  function appendLog(text) {
    if (!text || !logTerminal) return;
    const clean = text.trim();
    if (!clean) return;
    logBuffer.push(clean);

    if (!logFlushTimer) {
      logFlushTimer = setTimeout(() => {
        if (logBuffer.length > 0 && logTerminal) {
          logTerminal.textContent += '\n' + logBuffer.join('\n');
          // Limit total lines in memory to prevent RAM bloat on 24/7 streams
          const lines = logTerminal.textContent.split('\n');
          if (lines.length > 250) {
            logTerminal.textContent = lines.slice(-180).join('\n');
          }
          logTerminal.scrollTop = logTerminal.scrollHeight;
          logBuffer = [];
        }
        logFlushTimer = null;
      }, 300);
    }
  }

  btnCopyLog.addEventListener('click', () => {
    navigator.clipboard.writeText(logTerminal.textContent);
    btnCopyLog.textContent = 'Copied!';
    setTimeout(() => { btnCopyLog.textContent = 'Copy'; }, 1500);
  });

  btnClearLog.addEventListener('click', () => {
    logTerminal.textContent = 'Console cleared.';
    logBuffer = [];
  });

  // 5. System Stats Updates
  window.api.onSystemStats((stats) => {
    if (statCpu) statCpu.textContent = `${stats.cpuPercent}%`;
    if (statRam) statRam.textContent = `${stats.memoryPercent}%`;
    if (statActive) statActive.textContent = stats.activeStreamsCount;
  });

  // 6. Real-time Telemetry & Stream Status
  window.api.onStreamProgress(({ streamId, metrics }) => {
    if (streamId === 'stream-main') {
      if (metrics.bitrate) metricBitrate.textContent = metrics.bitrate;
      if (metrics.fps) {
        metricFps.textContent = metrics.fps;
        const fpsNum = parseFloat(metrics.fps);
        metricFps.style.color = fpsNum >= 29 ? '#10b981' : '#f59e0b';
      }
      if (metrics.speed) metricSpeed.textContent = metrics.speed;
      if (metrics.frame) metricFrames.textContent = metrics.frame;
      if (metrics.drop) {
        metricDrops.textContent = metrics.drop;
        metricDrops.style.color = parseInt(metrics.drop, 10) > 0 ? '#ef4444' : '#10b981';
      }
    }
  });

  window.api.onStreamLog(({ text }) => appendLog(text));

  window.api.onStreamStatus(({ streamId, status, message }) => {
    if (streamId === 'stream-main') {
      if (status === 'live') {
        isStreaming = true;
        statusPillHud.className = 'status-indicator-pill live';
        statusTextHud.textContent = 'ON AIR';
        statusLiveTag.textContent = 'BROADCASTING LIVE';
        statusLiveTag.style.color = '#10b981';
        btnStartStream.disabled = true;
        btnStopStream.disabled = false;
        startDurationTimer();
      } else if (status === 'reconnecting') {
        statusPillHud.className = 'status-indicator-pill reconnecting';
        statusTextHud.textContent = 'RECONNECTING';
        statusLiveTag.textContent = 'RECONNECTING...';
        statusLiveTag.style.color = '#f59e0b';
      } else if (status === 'stopped' || status === 'error') {
        isStreaming = false;
        statusPillHud.className = 'status-indicator-pill standby';
        statusTextHud.textContent = 'STANDBY';
        statusLiveTag.textContent = 'STANDBY';
        statusLiveTag.style.color = '#fff';
        btnStartStream.disabled = false;
        btnStopStream.disabled = true;
        stopDurationTimer();
        if (message) appendLog(`[Status] ${message}`);
      }
    }
  });

  function startDurationTimer() {
    streamStartTime = Date.now();
    if (durationInterval) clearInterval(durationInterval);
    durationInterval = setInterval(() => {
      if (!streamStartTime) return;
      const elapsed = Math.floor((Date.now() - streamStartTime) / 1000);
      const hrs = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const mins = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      metricDuration.textContent = `${hrs}:${mins}:${secs}`;
    }, 1000);
  }

  function stopDurationTimer() {
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
  }

  const cfgStreamMode = document.getElementById('cfg-stream-mode');

  // 7. Start & Stop Broadcast
  function gatherStreamConfig(id = 'stream-main') {
    if (!currentFile) {
      alert('Please select or drop a source video file first!');
      return null;
    }

    const ytOn = enableYt.checked;
    const fbOn = enableFb.checked;
    const ttOn = enableTt.checked;
    const customOn = enableCustom.checked;

    if (!ytOn && !fbOn && !ttOn && !customOn) {
      alert('Please activate at least one broadcast target (TikTok, YouTube, Facebook, or Custom RTMP)!');
      return null;
    }

    if (ttOn && !keyTt.value.trim()) {
      alert('Please enter your TikTok Stream Key!');
      return null;
    }
    if (ytOn && !keyYt.value.trim()) {
      alert('Please enter your YouTube Stream Key!');
      return null;
    }
    if (fbOn && !keyFb.value.trim()) {
      alert('Please enter your Facebook Stream Key!');
      return null;
    }
    if (customOn && !urlCustom.value.trim()) {
      alert('Please enter your Custom RTMP URL!');
      return null;
    }

    return {
      id,
      filePath: currentFile.filePath,
      streamMode: cfgStreamMode ? cfgStreamMode.value : 'copy',
      rdpMode: isRdpMode,
      threads: isRdpMode ? 1 : 2,
      youtubeEnabled: ytOn,
      youtubeKey: keyYt.value.trim(),
      facebookEnabled: fbOn,
      facebookKey: keyFb.value.trim(),
      tiktokEnabled: ttOn,
      tiktokServer: serverTt.value.trim(),
      tiktokKey: keyTt.value.trim(),
      customEnabled: customOn,
      customRtmpUrl: urlCustom.value.trim(),
      bitrate: cfgBitrate.value,
      resolution: cfgResolution.value,
      preset: cfgPreset.value,
      fps: cfgFps.value,
      audioBitrate: cfgAudioBitrate.value,
      customFfmpegPath: cfgCustomFfmpeg.value.trim(),
      infiniteLoop: cfgInfiniteLoop.checked,
      autoReconnect: cfgAutoReconnect.checked
    };
  }

  btnStartStream.addEventListener('click', async () => {
    const config = gatherStreamConfig('stream-main');
    if (!config) return;

    appendLog(`🚀 Launching broadcast [Mode: ${config.streamMode.toUpperCase()} | RDP: ${config.rdpMode ? 'ECO' : 'OFF'}]...`);
    statusTextHud.textContent = 'CONNECTING...';
    btnStartStream.disabled = true;

    const result = await window.api.startStream(config);
    if (!result.success) {
      alert('Failed to launch broadcast: ' + result.error);
      statusPillHud.className = 'status-indicator-pill standby';
      statusTextHud.textContent = 'STANDBY';
      btnStartStream.disabled = false;
    }
  });

  btnStopStream.addEventListener('click', async () => {
    appendLog('🛑 Terminating live broadcast...');
    await window.api.stopStream('stream-main');
  });

  // 8. Scheduler Logic
  btnSetSchedule.addEventListener('click', () => {
    const val = scheduleDatetime.value;
    if (!val) {
      alert('Please select a target date and time!');
      return;
    }

    const targetDate = new Date(val);
    if (targetDate <= new Date()) {
      alert('The scheduled time must be in the future!');
      return;
    }

    const config = gatherStreamConfig('stream-main');
    if (!config) return;

    targetScheduleDate = targetDate;
    countdownContainer.style.display = 'block';
    btnCancelSchedule.style.display = 'block';
    btnSetSchedule.style.display = 'none';
    scheduleBadge.textContent = 'SCHEDULED';
    scheduleBadge.style.color = '#6ee7b7';
    scheduleBadge.style.borderColor = 'rgba(110, 231, 183, 0.4)';
    scheduleTargetText.textContent = `Auto-Broadcast Set: ${targetDate.toLocaleString()}`;

    if (scheduleTimer) clearInterval(scheduleTimer);
    scheduleTimer = setInterval(() => {
      const remainingMs = targetScheduleDate - new Date();
      if (remainingMs <= 0) {
        clearInterval(scheduleTimer);
        scheduleTimer = null;
        countdownDisplay.textContent = '00:00:00';
        scheduleBadge.textContent = 'TRIGGERED';
        btnCancelSchedule.style.display = 'none';
        btnSetSchedule.style.display = 'block';
        appendLog('⏰ Scheduled time reached! Triggering broadcast automatically...');
        btnStartStream.click();
        return;
      }

      const totalSecs = Math.floor(remainingMs / 1000);
      const h = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
      const m = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
      const s = String(totalSecs % 60).padStart(2, '0');
      countdownDisplay.textContent = `${h}:${m}:${s}`;
    }, 1000);
  });

  btnCancelSchedule.addEventListener('click', () => {
    if (scheduleTimer) {
      clearInterval(scheduleTimer);
      scheduleTimer = null;
    }
    countdownContainer.style.display = 'none';
    btnCancelSchedule.style.display = 'none';
    btnSetSchedule.style.display = 'block';
    scheduleBadge.textContent = 'STANDBY';
    scheduleBadge.style.color = '#a5b4fc';
    scheduleBadge.style.borderColor = 'rgba(99, 102, 241, 0.4)';
    appendLog('Scheduled broadcast cancelled.');
  });

  // 9. Multi-Stream Independent Channel Cards (Optimized for 4-Core RDP)
  function createMultiStreamChannel() {
    multiStreamCount++;
    const channelId = `channel-${multiStreamCount}`;
    let channelFile = null;
    let channelStreaming = false;

    const card = document.createElement('div');
    card.className = 'channel-row-card';
    card.id = channelId;

    card.innerHTML = `
      <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-weight: 800; font-size: 0.95rem; color: #fff;">Channel #${multiStreamCount}</span>
            <span class="pro-badge ch-status" style="color: #94a3b8; border-color: rgba(255,255,255,0.1);">STANDBY</span>
          </div>
          <select class="cyber-input ch-mode" style="max-width: 240px; font-size: 0.74rem; padding: 4px 8px; border-color: rgba(110, 231, 183, 0.3);">
            <option value="copy" selected>🚀 Passthrough (0% CPU for RDP)</option>
            <option value="eco">⚡ Eco Re-encode (1-Thread)</option>
          </select>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="btn-golive btn-ch-browse" style="padding: 6px 14px; font-size: 0.76rem; border-radius: 8px; flex: initial;">Select Video</button>
          <span class="ch-file-name" style="font-size: 0.78rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">No video selected</span>
        </div>
        <div class="cyber-input-wrapper" style="margin-top: 2px;">
          <input type="password" class="cyber-input ch-key" placeholder="Paste Destination RTMP Key or Full URL" style="max-width: 500px;">
        </div>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button class="btn-golive btn-ch-start" style="padding: 10px 20px; font-size: 0.82rem; border-radius: 10px; flex: initial;">Go Live</button>
        <button class="btn-stoplive btn-ch-stop" style="padding: 10px 18px; font-size: 0.82rem; border-radius: 10px; flex: initial;" disabled>Stop</button>
        <button class="btn-dismiss btn-ch-del" title="Delete Channel">✕</button>
      </div>
    `;

    const btnBrowse = card.querySelector('.btn-ch-browse');
    const chFileName = card.querySelector('.ch-file-name');
    const chKey = card.querySelector('.ch-key');
    const chMode = card.querySelector('.ch-mode');
    const btnStart = card.querySelector('.btn-ch-start');
    const btnStop = card.querySelector('.btn-ch-stop');
    const btnDel = card.querySelector('.btn-ch-del');
    const chStatus = card.querySelector('.ch-status');

    btnBrowse.addEventListener('click', async () => {
      const selected = await window.api.selectVideo();
      if (selected) {
        channelFile = selected;
        chFileName.textContent = `${selected.fileName} (${selected.fileSizeMB} MB)`;
        chFileName.style.color = '#a5b4fc';
      }
    });

    btnStart.addEventListener('click', async () => {
      if (!channelFile) {
        alert('Please choose a video file for this channel!');
        return;
      }
      const rawTarget = chKey.value.trim();
      if (!rawTarget) {
        alert('Please enter an RTMP Key or URL for this channel!');
        return;
      }

      let customUrl = rawTarget;
      let ytKey = '';
      if (!rawTarget.startsWith('rtmp://') && !rawTarget.startsWith('rtmps://')) {
        ytKey = rawTarget;
      }

      const cfg = {
        id: channelId,
        filePath: channelFile.filePath,
        streamMode: chMode.value, // Passthrough or Eco
        rdpMode: isRdpMode,
        threads: 1, // Cap each parallel channel to 1 thread for RDP stability
        youtubeEnabled: Boolean(ytKey),
        youtubeKey: ytKey,
        customEnabled: !ytKey,
        customRtmpUrl: customUrl,
        bitrate: '2500k',
        preset: 'ultrafast',
        fps: '30',
        resolution: 'original',
        audioBitrate: '128k',
        infiniteLoop: true,
        autoReconnect: true
      };

      const res = await window.api.startStream(cfg);
      if (res.success) {
        channelStreaming = true;
        chStatus.textContent = 'ON AIR';
        chStatus.style.color = '#10b981';
        chStatus.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        btnStart.disabled = true;
        btnStop.disabled = false;
        appendLog(`[Multi-Channel] ${channelId} started [Mode: ${cfg.streamMode.toUpperCase()}].`);
      } else {
        alert('Failed to start channel: ' + res.error);
      }
    });

    btnStop.addEventListener('click', async () => {
      await window.api.stopStream(channelId);
      channelStreaming = false;
      chStatus.textContent = 'STANDBY';
      chStatus.style.color = '#94a3b8';
      chStatus.style.borderColor = 'rgba(255,255,255,0.1)';
      btnStart.disabled = false;
      btnStop.disabled = true;
      appendLog(`[Multi-Channel] ${channelId} stopped.`);
    });

    btnDel.addEventListener('click', async () => {
      if (channelStreaming) await window.api.stopStream(channelId);
      card.remove();
    });

    multiStreamContainer.appendChild(card);
  }

  btnAddMultiChannel.addEventListener('click', createMultiStreamChannel);

  // Initialize with one ready channel
  createMultiStreamChannel();
});
