const api = window.ascBroadcast;

const matchView = document.getElementById('match-view');
const matchLabel = document.getElementById('match-label');
const matchInput = document.getElementById('match-id');
const matchError = document.getElementById('match-error');
const loadForm = document.getElementById('load-form');

const connDot = document.getElementById('conn-dot');
const connLabel = document.getElementById('conn-label');
const streamLabel = document.getElementById('stream-label');
const obsError = document.getElementById('obs-error');

const btnSettings = document.getElementById('btn-settings');
const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnReplay = document.getElementById('btn-replay');

const settingsModal = document.getElementById('settings-modal');
const settingsForm = document.getElementById('settings-form');
const obsHost = document.getElementById('obs-host');
const obsPort = document.getElementById('obs-port');
const obsPassword = document.getElementById('obs-password');
const obsAppPath = document.getElementById('obs-app-path');
const obsCollection = document.getElementById('obs-collection');
const obsProfile = document.getElementById('obs-profile');
const btnSettingsCancel = document.getElementById('btn-settings-cancel');

/** @type {{ connection: string, error: string, stream: { outputActive: boolean, outputReconnecting: boolean, outputTimecode: string, outputState: string } } | null} */
let lastStatus = null;
let busy = false;

function streamStateLabel(status) {
  const state = status.stream.outputState;
  if (state === 'OBS_WEBSOCKET_OUTPUT_STARTING') {
    return 'Stream starting…';
  }
  if (state === 'OBS_WEBSOCKET_OUTPUT_STOPPING') {
    return 'Stream stopping…';
  }
  if (status.stream.outputReconnecting || state === 'OBS_WEBSOCKET_OUTPUT_RECONNECTING') {
    return 'Stream reconnecting…';
  }
  if (status.stream.outputActive) {
    const clock = status.stream.outputTimecode ? ` ${status.stream.outputTimecode}` : '';
    return `Streaming${clock}`;
  }
  return 'Stream idle';
}

function connectionLabel(status) {
  if (status.lifecycle === 'launching') return 'Launching OBS…';
  if (status.lifecycle === 'waiting') return 'Waiting for OBS…';
  if (status.connection === 'connected') return 'Connected';
  if (status.connection === 'connecting') return 'Connecting…';
  if (status.connection === 'error' || status.lifecycle === 'error') return 'Error';
  return 'Disconnected';
}

function renderStatus(status) {
  lastStatus = status;
  const connected = status.connection === 'connected';
  const connecting =
    status.connection === 'connecting' ||
    status.lifecycle === 'launching' ||
    status.lifecycle === 'waiting';
  const starting = status.stream.outputState === 'OBS_WEBSOCKET_OUTPUT_STARTING';
  const stopping = status.stream.outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPING';

  const dotState = connecting ? 'connecting' : status.connection;
  connDot.className = `dot ${dotState}`;
  connLabel.textContent = connectionLabel(status);
  let streamText = 'Stream idle';
  if (connected) {
    streamText = streamStateLabel(status);
    if (status.replayBufferState === 'active' || status.replayBufferActive) {
      streamText += ' · Replay ready';
    } else if (status.replayBufferState === 'inactive') {
      streamText += ' · Replay off';
    } else if (status.replayBufferState === 'unavailable') {
      streamText += ' · Replay unavailable';
    }
  }
  streamLabel.textContent = streamText;

  const errorText = status.error || status.replayBufferWarning || '';
  if (errorText) {
    obsError.hidden = false;
    obsError.textContent = errorText;
  } else {
    obsError.hidden = true;
    obsError.textContent = '';
  }

  btnConnect.hidden = connected;
  btnConnect.disabled = busy || connecting;
  btnConnect.textContent =
    status.connection === 'error' || status.lifecycle === 'error' ? 'Reconnect' : 'Start OBS';
  btnDisconnect.hidden = !connected;
  btnDisconnect.disabled = busy;

  btnStart.disabled = busy || !connected || status.stream.outputActive || starting || stopping;
  btnStop.disabled = busy || !connected || (!status.stream.outputActive && !starting) || stopping;

  const replayActive = status.replayBufferState === 'active' || status.replayBufferActive;
  const needsReplayStart =
    connected && !replayActive && (status.replayBufferState === 'inactive' || status.replayBufferState === 'unavailable' || status.replayBufferWarning);
  btnReplay.hidden = !needsReplayStart;
  btnReplay.disabled = busy || !connected;
  btnReplay.textContent =
    status.replayBufferState === 'unavailable' ? 'Retry Replay Buffer' : 'Start Replay Buffer';
}

async function withBusy(fn) {
  busy = true;
  if (lastStatus) {
    renderStatus(lastStatus);
  }
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OBS command failed.';
    obsError.hidden = false;
    obsError.textContent = message;
  } finally {
    busy = false;
    const status = await api.getObsStatus();
    renderStatus(status);
  }
}

function applyShellState(state) {
  if (state.view === 'panel') {
    matchView.hidden = true;
    matchLabel.textContent = state.matchId ? `Match ${state.matchId}` : 'Control panel';
    return;
  }
  matchView.hidden = false;
  matchLabel.textContent = 'No match loaded';
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
  settingsModal.hidden = false;
  api.setSettingsOpen(true);
  obsHost.focus();
}

function closeSettings() {
  settingsModal.hidden = true;
  api.setSettingsOpen(false);
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

btnConnect.addEventListener('click', () => {
  void withBusy(() => api.connectObs());
});

btnDisconnect.addEventListener('click', () => {
  void withBusy(() => api.disconnectObs());
});

btnStart.addEventListener('click', () => {
  void withBusy(() => api.startStream());
});

btnStop.addEventListener('click', () => {
  void withBusy(() => api.stopStream());
});

btnReplay.addEventListener('click', () => {
  void withBusy(() => api.startReplayBuffer());
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

api.onObsStatus(renderStatus);
api.onShellState(applyShellState);
api.onOpenObsSettings(() => {
  void openSettings();
});

void api.getObsStatus().then(renderStatus);
