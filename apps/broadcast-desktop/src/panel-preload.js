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
    saveBoundaryClip(deliveryId) {
      return ipcRenderer.invoke('asc:obs-save-boundary-clip', deliveryId);
    },
    playDeliveryClip(payload) {
      return ipcRenderer.invoke('asc:obs-play-delivery-clip', payload);
    },
    playFileOnAir(filePath) {
      return ipcRenderer.invoke('asc:obs-play-file', filePath);
    },
    buildHighlight(payload) {
      return ipcRenderer.invoke('asc:build-highlight', payload);
    },
    getHighlight(payload) {
      return ipcRenderer.invoke('asc:get-highlight', payload);
    },
    /** @deprecated Prefer buildHighlight({ kind: 'innings-1' }). */
    buildInningsHighlight(payload) {
      return ipcRenderer.invoke('asc:build-highlight', {
        ...(payload || {}),
        kind: 'innings-1',
      });
    },
    /** @deprecated Prefer getHighlight({ kind: 'innings-1' }). */
    getInningsHighlight(matchId) {
      return ipcRenderer.invoke('asc:get-highlight', {
        matchId,
        kind: 'innings-1',
      });
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
