/**
 * Preload bridge for the ASC Broadcast shell.
 * The hosted control panel (BrowserView) does not use this bridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ascBroadcast', {
  loadControlPanel(matchId) {
    ipcRenderer.send('asc:load-control-panel', matchId);
  },
  showMatchEntry() {
    ipcRenderer.send('asc:show-match-entry');
  },
  getObsConfig() {
    return ipcRenderer.invoke('asc:obs-get-config');
  },
  saveObsConfig(config) {
    return ipcRenderer.invoke('asc:obs-save-config', config);
  },
  getObsStatus() {
    return ipcRenderer.invoke('asc:obs-get-status');
  },
  connectObs() {
    return ipcRenderer.invoke('asc:obs-connect');
  },
  disconnectObs() {
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
  setSettingsOpen(open) {
    ipcRenderer.send('asc:settings-open', open);
  },
  onObsStatus(callback) {
    const listener = (_event, status) => {
      callback(status);
    };
    ipcRenderer.on('asc:obs-status', listener);
    return () => ipcRenderer.removeListener('asc:obs-status', listener);
  },
  onShellState(callback) {
    const listener = (_event, state) => {
      callback(state);
    };
    ipcRenderer.on('asc:shell-state', listener);
    return () => ipcRenderer.removeListener('asc:shell-state', listener);
  },
  onOpenObsSettings(callback) {
    const listener = () => {
      callback();
    };
    ipcRenderer.on('asc:open-obs-settings', listener);
    return () => ipcRenderer.removeListener('asc:open-obs-settings', listener);
  },
});
