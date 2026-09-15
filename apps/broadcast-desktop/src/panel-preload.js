/**
 * Preload bridge for the BrowserView (scoring cockpit).
 * OBS control + config — never expose shell match-entry channels or raw ipcRenderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ascBroadcast', {
  capabilities: Object.freeze({ obs: true }),
  obs: {
    getStatus() {
      return ipcRenderer.invoke('asc:obs-get-status');
    },
    connect() {
      return ipcRenderer.invoke('asc:obs-connect');
    },
    disconnect() {
      return ipcRenderer.invoke('asc:obs-disconnect');
    },
    startStream() {
      return ipcRenderer.invoke('asc:obs-start-stream');
    },
    stopStream() {
      return ipcRenderer.invoke('asc:obs-stop-stream');
    },
    startReplayBuffer() {
      return ipcRenderer.invoke('asc:obs-start-replay-buffer');
    },
    startInstantReplay() {
      return ipcRenderer.invoke('asc:obs-instant-replay');
    },
    returnToLive() {
      return ipcRenderer.invoke('asc:obs-return-to-live');
    },
    getConfig() {
      return ipcRenderer.invoke('asc:obs-get-config');
    },
    saveConfig(config) {
      return ipcRenderer.invoke('asc:obs-save-config', config);
    },
    onStatus(callback) {
      const listener = (_event, status) => {
        callback(status);
      };
      ipcRenderer.on('asc:obs-status', listener);
      return () => ipcRenderer.removeListener('asc:obs-status', listener);
    },
    onOpenSettings(callback) {
      const listener = () => {
        callback();
      };
      ipcRenderer.on('asc:open-obs-settings', listener);
      return () => ipcRenderer.removeListener('asc:open-obs-settings', listener);
    },
  },
});
