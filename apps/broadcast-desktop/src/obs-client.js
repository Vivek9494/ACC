/**
 * obs-websocket v5 control layer (Steps 2–3).
 * Confirmed protocol names:
 *   GetStreamStatus / StartStream / StopStream / StreamStateChanged
 *   GetReplayBufferStatus / StartReplayBuffer / ReplayBufferStateChanged
 *   GetProfileParameter / SetProfileParameter (RecRB enable)
 */

const { OBSWebSocket, OBSWebSocketError } = require('obs-websocket-js');

/** Max replay length in seconds (15 before + 15 after + margin). */
const REPLAY_BUFFER_SECONDS = 35;

/** @typedef {'disconnected' | 'connecting' | 'connected' | 'error'} ConnectionState */
/** @typedef {'unknown' | 'unavailable' | 'inactive' | 'active'} ReplayBufferState */

function emptyStreamStatus() {
  return {
    outputActive: false,
    outputReconnecting: false,
    outputTimecode: '',
    outputDuration: 0,
    outputState: '',
  };
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function describeObsError(err) {
  const code = err && typeof err === 'object' && 'code' in err ? err.code : undefined;
  const message =
    err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
      ? err.message
      : '';

  if (code === 4009 || message.includes('4009') || /authentication failed/i.test(message)) {
    return 'Wrong OBS websocket password.';
  }
  if (code === 'ECONNREFUSED' || message.includes('ECONNREFUSED')) {
    return 'OBS is not running, or websocket is not listening on that host/port.';
  }
  if (code === 'ENOTFOUND' || code === 'EHOSTUNREACH' || code === 'ETIMEDOUT') {
    return 'Cannot reach OBS at that host. Check host and port.';
  }
  if (code === 4006 || code === 4010) {
    return 'OBS rejected the websocket connection (unsupported protocol). Use OBS 28+ with obs-websocket v5.';
  }
  if (
    code === 604 ||
    /replay buffer is not available/i.test(message) ||
    /replaybuffer.*not available/i.test(message)
  ) {
    return (
      'Replay buffer is not available in the running OBS session. ' +
      'In OBS: Settings → Output → enable Replay Buffer (max ~35s), Apply, ' +
      'then click “Start Replay Buffer” here. (A full OBS restart also picks up the profile setting.)'
    );
  }
  if (err instanceof OBSWebSocketError) {
    return message || `OBS websocket error (${err.code}).`;
  }
  if (message) {
    return message;
  }
  return 'Could not connect to OBS.';
}

function isRetryableObsError(err) {
  const message = describeObsError(err);
  return (
    message.includes('not running') ||
    message.includes('not listening') ||
    message.includes('Cannot reach OBS')
  );
}

function isReplayUnavailableError(err) {
  const code = err && typeof err === 'object' && 'code' in err ? err.code : undefined;
  const message =
    err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
      ? err.message
      : '';
  return (
    code === 604 ||
    /replay buffer is not available/i.test(message) ||
    /replaybuffer.*not available/i.test(message)
  );
}

class ObsController {
  constructor() {
    /** @type {OBSWebSocket} */
    this.obs = new OBSWebSocket();
    /** @type {ConnectionState} */
    this.connection = 'disconnected';
    /** @type {string} */
    this.error = '';
    this.stream = emptyStreamStatus();
    /** @type {ReplayBufferState} */
    this.replayBufferState = 'unknown';
    /** @type {Set<(snapshot: ReturnType<ObsController['snapshot']>) => void>} */
    this.listeners = new Set();
    /** @type {ReturnType<typeof setInterval> | null} */
    this.statusTimer = null;
    this.bound = false;
  }

  get replayBufferActive() {
    return this.replayBufferState === 'active';
  }

  /** @param {(snapshot: ReturnType<ObsController['snapshot']>) => void} listener */
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot() {
    return {
      connection: this.connection,
      error: this.error,
      stream: { ...this.stream },
      replayBufferState: this.replayBufferState,
      replayBufferActive: this.replayBufferActive,
    };
  }

  emit() {
    const snap = this.snapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  bindEvents() {
    if (this.bound) {
      return;
    }
    this.bound = true;

    this.obs.on('ConnectionClosed', (err) => {
      this.stopStatusPoll();
      if (this.connection === 'connecting') {
        return;
      }
      this.connection = err ? 'error' : 'disconnected';
      this.error = err ? describeObsError(err) : '';
      this.stream = emptyStreamStatus();
      this.replayBufferState = 'unknown';
      this.emit();
    });

    this.obs.on('ConnectionError', (err) => {
      this.stopStatusPoll();
      this.connection = 'error';
      this.error = describeObsError(err);
      this.stream = emptyStreamStatus();
      this.replayBufferState = 'unknown';
      this.emit();
    });

    this.obs.on('StreamStateChanged', (event) => {
      this.stream.outputActive = Boolean(event.outputActive);
      this.stream.outputState = String(event.outputState ?? '');
      this.stream.outputReconnecting = event.outputState === 'OBS_WEBSOCKET_OUTPUT_RECONNECTING';
      if (!this.stream.outputActive && this.stream.outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPED') {
        this.stream.outputTimecode = '';
        this.stream.outputDuration = 0;
      }
      this.emit();
      void this.refreshStreamStatus();
    });

    this.obs.on('ReplayBufferStateChanged', (event) => {
      this.replayBufferState = event.outputActive ? 'active' : 'inactive';
      this.emit();
    });
  }

  startStatusPoll() {
    this.stopStatusPoll();
    this.statusTimer = setInterval(() => {
      void this.refreshStreamStatus();
      void this.refreshReplayBufferStatus();
    }, 1000);
  }

  stopStatusPoll() {
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
  }

  async refreshStreamStatus() {
    if (this.connection !== 'connected') {
      return;
    }
    try {
      const status = await this.obs.call('GetStreamStatus');
      this.stream.outputActive = Boolean(status.outputActive);
      this.stream.outputReconnecting = Boolean(status.outputReconnecting);
      this.stream.outputTimecode = status.outputTimecode || '';
      this.stream.outputDuration = Number(status.outputDuration) || 0;
      if (this.stream.outputActive && !this.stream.outputState) {
        this.stream.outputState = 'OBS_WEBSOCKET_OUTPUT_STARTED';
      }
      if (!this.stream.outputActive && !this.stream.outputState) {
        this.stream.outputState = 'OBS_WEBSOCKET_OUTPUT_STOPPED';
      }
      this.emit();
    } catch (err) {
      this.error = describeObsError(err);
      this.emit();
    }
  }

  /**
   * @param {{ host: string, port: number, password: string }} config
   */
  async connect(config) {
    this.bindEvents();
    await this.disconnect({ silent: true });
    this.connection = 'connecting';
    this.error = '';
    this.stream = emptyStreamStatus();
    this.replayBufferState = 'unknown';
    this.emit();

    const url = `ws://${config.host}:${config.port}`;
    try {
      await this.obs.connect(url, config.password || undefined);
      this.connection = 'connected';
      this.error = '';
      await this.refreshStreamStatus();
      await this.refreshReplayBufferStatus();
      this.startStatusPoll();
      this.emit();
    } catch (err) {
      this.connection = 'error';
      this.error = describeObsError(err);
      this.stream = emptyStreamStatus();
      this.replayBufferState = 'unknown';
      this.stopStatusPoll();
      this.emit();
      throw new Error(this.error);
    }
  }

  /** @param {{ silent?: boolean }} [opts] */
  async disconnect(opts = {}) {
    this.stopStatusPoll();
    try {
      await this.obs.disconnect();
    } catch {
      // already closed
    }
    this.connection = 'disconnected';
    this.error = '';
    this.stream = emptyStreamStatus();
    this.replayBufferState = 'unknown';
    if (!opts.silent) {
      this.emit();
    }
  }

  async startStream() {
    if (this.connection !== 'connected') {
      throw new Error('Not connected to OBS.');
    }
    try {
      await this.obs.call('StartStream');
    } catch (err) {
      throw new Error(describeObsError(err));
    }
  }

  async stopStream() {
    if (this.connection !== 'connected') {
      throw new Error('Not connected to OBS.');
    }
    try {
      await this.obs.call('StopStream');
    } catch (err) {
      throw new Error(describeObsError(err));
    }
  }

  async refreshReplayBufferStatus() {
    if (this.connection !== 'connected') {
      return;
    }
    try {
      const status = await this.obs.call('GetReplayBufferStatus');
      this.replayBufferState = status.outputActive ? 'active' : 'inactive';
      this.emit();
    } catch (err) {
      if (isReplayUnavailableError(err)) {
        this.replayBufferState = 'unavailable';
        this.emit();
        return;
      }
      // Other transient errors — leave previous state.
    }
  }

  /**
   * Persist RecRB=true + RecRBTime in the OBS profile (Simple + Advanced).
   * Note: a running OBS session may still need Settings→Apply or a restart
   * before StartReplayBuffer succeeds.
   */
  async ensureReplayBufferEnabledInProfile() {
    if (this.connection !== 'connected') {
      throw new Error('Not connected to OBS.');
    }
    const seconds = String(REPLAY_BUFFER_SECONDS);
    for (const category of ['SimpleOutput', 'AdvOut']) {
      await this.obs.call('SetProfileParameter', {
        parameterCategory: category,
        parameterName: 'RecRB',
        parameterValue: 'true',
      });
      await this.obs.call('SetProfileParameter', {
        parameterCategory: category,
        parameterName: 'RecRBTime',
        parameterValue: seconds,
      });
    }
  }

  async ensureReplayBuffer() {
    if (this.connection !== 'connected') {
      throw new Error('Not connected to OBS.');
    }
    await this.refreshReplayBufferStatus();
    if (this.replayBufferActive) {
      return;
    }

    try {
      await this.ensureReplayBufferEnabledInProfile();
    } catch (err) {
      throw new Error(describeObsError(err));
    }

    try {
      await this.obs.call('StartReplayBuffer');
      await this.refreshReplayBufferStatus();
      if (!this.replayBufferActive) {
        throw new Error(
          'Replay buffer did not become active after StartReplayBuffer. Check OBS Output settings.',
        );
      }
    } catch (err) {
      await this.refreshReplayBufferStatus();
      throw new Error(describeObsError(err));
    }
  }
}

module.exports = {
  ObsController,
  describeObsError,
  isRetryableObsError,
  REPLAY_BUFFER_SECONDS,
};
