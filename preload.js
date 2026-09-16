const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Dialogs
  selectVideo: () => ipcRenderer.invoke('dialog:select-video'),
  
  // Stream Control
  startStream: (streamConfig) => ipcRenderer.invoke('stream:start', streamConfig),
  stopStream: (streamId) => ipcRenderer.invoke('stream:stop', streamId),
  getStreams: () => ipcRenderer.invoke('stream:get-all'),
  
  // Real-time Event Listeners
  onStreamProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('stream:progress', handler);
    return () => ipcRenderer.removeListener('stream:progress', handler);
  },
  onStreamLog: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('stream:log', handler);
    return () => ipcRenderer.removeListener('stream:log', handler);
  },
  onStreamStatus: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('stream:status', handler);
    return () => ipcRenderer.removeListener('stream:status', handler);
  },

  // System Resources
  getSystemStats: () => ipcRenderer.invoke('system:get-stats'),
  onSystemStats: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('system:stats-update', handler);
    return () => ipcRenderer.removeListener('system:stats-update', handler);
  },

  // Config Persistence
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Cloud Auto-Updater & External Links
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  checkAppUpdate: (customGistUrl) => ipcRenderer.invoke('app:check-update', customGistUrl),
  downloadAppUpdate: (updateInfo) => ipcRenderer.invoke('app:download-update', updateInfo),
  onUpdateProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('app:update-progress', handler);
    return () => ipcRenderer.removeListener('app:update-progress', handler);
  },
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url)
});
