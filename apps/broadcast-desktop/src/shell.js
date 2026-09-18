const api = window.ascBroadcast;

const matchView = document.getElementById('match-view');
const matchInput = document.getElementById('match-id');
const matchError = document.getElementById('match-error');
const loadForm = document.getElementById('load-form');

const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const settingsForm = document.getElementById('settings-form');
const obsHost = document.getElementById('obs-host');
const obsPort = document.getElementById('obs-port');
const obsPassword = document.getElementById('obs-password');
const obsAppPath = document.getElementById('obs-app-path');
const obsCollection = document.getElementById('obs-collection');
const obsProfile = document.getElementById('obs-profile');
const obsLiveScene = document.getElementById('obs-live-scene');
const obsOverlayScene = document.getElementById('obs-overlay-scene');
const obsOverlayUrl = document.getElementById('obs-overlay-url');
const obsReplayScene = document.getElementById('obs-replay-scene');
const obsReplayMedia = document.getElementById('obs-replay-media');
const btnSettingsCancel = document.getElementById('btn-settings-cancel');

function applyShellState(state) {
  if (state.view === 'panel') {
    matchView.hidden = true;
    return;
  }
  matchView.hidden = false;
  if (state.lastMatchId) {
    matchInput.value = state.lastMatchId;
  }
}

async function openSettings() {
  const config = await api.getObsConfig();
  obsHost.value = config.host;
  obsPort.value = String(config.port);
  obsPassword.value = config.password;
  obsAppPath.value = config.obsAppPath;
  obsCollection.value = config.sceneCollection || '';
  obsProfile.value = config.profile || '';
  obsLiveScene.value = config.liveSceneName || 'Scene';
  obsOverlayScene.value = config.overlaySceneName || 'Scene';
  obsOverlayUrl.value = config.overlayUrlBase || 'https://acc-overlay.netlify.app';
  obsReplayScene.value = config.replaySceneName || 'Replay';
  obsReplayMedia.value = config.replayMediaSourceName || 'Replay Media';
  settingsModal.hidden = false;
  obsHost.focus();
}

function closeSettings() {
  settingsModal.hidden = true;
}

loadForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const matchId = (matchInput.value || '').trim();
  if (!matchId) {
    matchError.hidden = false;
    matchInput.focus();
    return;
  }
  matchError.hidden = true;
  api.loadControlPanel(matchId);
});

btnSettings.addEventListener('click', () => {
  void openSettings();
});

btnSettingsCancel.addEventListener('click', () => {
  closeSettings();
});

settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void (async () => {
    await api.saveObsConfig({
      host: obsHost.value,
      port: obsPort.value,
      password: obsPassword.value,
      obsAppPath: obsAppPath.value,
      sceneCollection: obsCollection.value,
      profile: obsProfile.value,
      liveSceneName: obsLiveScene.value,
      overlaySceneName: obsOverlayScene.value,
      overlayUrlBase: obsOverlayUrl.value,
      replaySceneName: obsReplayScene.value,
      replayMediaSourceName: obsReplayMedia.value,
    });
    closeSettings();
  })();
});

settingsModal.addEventListener('click', (event) => {
  if (event.target === settingsModal) {
    closeSettings();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !settingsModal.hidden) {
    closeSettings();
  }
});

api.onShellState(applyShellState);
api.onOpenObsSettings(() => {
  // Only used when match-entry is visible (panel not covering the shell).
  if (!matchView.hidden) {
    void openSettings();
  }
});
