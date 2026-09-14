/**
 * obs-websocket v5 control layer (Steps 2–3 + Instant Replay).
 * Confirmed protocol names:
 *   GetStreamStatus / StartStream / StopStream / StreamStateChanged
 *   GetReplayBufferStatus / StartReplayBuffer / ReplayBufferStateChanged
 *   SaveReplayBuffer / ReplayBufferSaved / GetLastReplayBufferReplay
 *   SetInputSettings / SetCurrentProgramScene / TriggerMediaInputAction
 *   MediaInputPlaybackEnded / GetStudioModeEnabled
 *   GetProfileParameter / SetProfileParameter (RecRB enable)
 */

const { EventSubscription, OBSWebSocket, OBSWebSocketError } = require('obs-websocket-js');
const { DEFAULTS } = require('./obs-config');

/** Max replay length in seconds (15 before + 15 after + margin). */
const REPLAY_BUFFER_SECONDS = 35;

/** Force-return to live if MediaInputPlaybackEnded never arrives. */
const INSTANT_REPLAY_WATCHDOG_MS = 45_000;

/** Wait for ReplayBufferSaved before falling back to GetLastReplayBufferReplay. */
const SAVE_EVENT_WAIT_MS = 8_000;
const SAVE_FALLBACK_DELAY_MS = 750;

const MEDIA_RESTART = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART';

/** Explicit subscriptions — Outputs (ReplayBufferSaved) + MediaInputs (playback ended). */
const OBS_EVENT_SUBSCRIPTIONS =
  EventSubscription.General |
  EventSubscription.Config |
  EventSubscription.Scenes |
  EventSubscription.Inputs |
  EventSubscription.Transitions |
  EventSubscription.Outputs |
  EventSubscription.MediaInputs |
  EventSubscription.Ui;

/** @typedef {'disconnected' | 'connecting' | 'connected' | 'error'} ConnectionState */
/** @typedef {'unknown' | 'unavailable' | 'inactive' | 'active'} ReplayBufferState */
/** @typedef {'idle' | 'saving' | 'playing'} InstantReplayPhase */

function emptyStreamStatus() {
  return {
    outputActive: false,
    outputReconnecting: false,
    outputTimecode: '',
    outputDuration: 0,
    outputState: '',
  };
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
    /** @type {InstantReplayPhase} */
    this.instantReplayPhase = 'idle';
    this.isReplaying = false;
    /** @type {string} */
    this.studioModeWarning = '';
    /** @type {{ liveSceneName: string, replaySceneName: string, replayMediaSourceName: string }} */
    this.replayScenes = {
      liveSceneName: DEFAULTS.liveSceneName,
      replaySceneName: DEFAULTS.replaySceneName,
      replayMediaSourceName: DEFAULTS.replayMediaSourceName,
    };
    /** @type {string | null} */
    this.liveSceneBeforeReplay = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.watchdogTimer = null;
    /** @type {((path: string) => void) | null} */
    this.pendingSaveResolve = null;
    /** @type {((err: Error) => void) | null} */
    this.pendingSaveReject = null;
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
      isReplaying: this.isReplaying,
      instantReplayPhase: this.instantReplayPhase,
      studioModeWarning: this.studioModeWarning,
    };
  }

  emit() {
    const snap = this.snapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  /**
   * @param {{ liveSceneName?: string, replaySceneName?: string, replayMediaSourceName?: string }} config
   */
  applyReplaySceneConfig(config) {
    this.replayScenes = {
      liveSceneName: config.liveSceneName || DEFAULTS.liveSceneName,
      replaySceneName: config.replaySceneName || DEFAULTS.replaySceneName,
      replayMediaSourceName: config.replayMediaSourceName || DEFAULTS.replayMediaSourceName,
    };
  }

  bindEvents() {
    if (this.bound) {
      return;
    }
    this.bound = true;

    this.obs.on('ConnectionClosed', (err) => {
      this.stopStatusPoll();
      this.clearWatchdog();
      this.rejectPendingSave(new Error('OBS connection closed while saving the replay.'));
      this.isReplaying = false;
      this.instantReplayPhase = 'idle';
      this.liveSceneBeforeReplay = null;
      if (this.connection === 'connecting') {
        return;
      }
      this.connection = err ? 'error' : 'disconnected';
      this.error = err ? describeObsError(err) : '';
      this.stream = emptyStreamStatus();
      this.replayBufferState = 'unknown';
      this.studioModeWarning = '';
      this.emit();
    });

    this.obs.on('ConnectionError', (err) => {
      this.stopStatusPoll();
      this.clearWatchdog();
      this.rejectPendingSave(new Error(describeObsError(err)));
      this.isReplaying = false;
      this.instantReplayPhase = 'idle';
      this.liveSceneBeforeReplay = null;
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

    this.obs.on('ReplayBufferSaved', (event) => {
      const savedPath =
        typeof event?.savedReplayPath === 'string' ? event.savedReplayPath.trim() : '';
      if (!savedPath) {
        return;
      }
      if (this.pendingSaveResolve) {
        const resolve = this.pendingSaveResolve;
        this.pendingSaveResolve = null;
        this.pendingSaveReject = null;
        resolve(savedPath);
      }
    });

    this.obs.on('MediaInputPlaybackEnded', (event) => {
      const inputName = typeof event?.inputName === 'string' ? event.inputName : '';
      if (
        this.isReplaying &&
        inputName === this.replayScenes.replayMediaSourceName
      ) {
        void this.returnToLive({ reason: 'playback-ended' });
      }
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

  clearWatchdog() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  /** @param {Error} err */
  rejectPendingSave(err) {
    if (this.pendingSaveReject) {
      const reject = this.pendingSaveReject;
      this.pendingSaveResolve = null;
      this.pendingSaveReject = null;
      reject(err);
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
   * @param {{
   *   host: string,
   *   port: number,
   *   password: string,
   *   liveSceneName?: string,
   *   replaySceneName?: string,
   *   replayMediaSourceName?: string,
   * }} config
   */
  async connect(config) {
    this.bindEvents();
    await this.disconnect({ silent: true });
    this.applyReplaySceneConfig(config);
    this.connection = 'connecting';
    this.error = '';
    this.stream = emptyStreamStatus();
    this.replayBufferState = 'unknown';
    this.studioModeWarning = '';
    this.emit();

    const url = `ws://${config.host}:${config.port}`;
    try {
      await this.obs.connect(url, config.password || undefined, {
        eventSubscriptions: OBS_EVENT_SUBSCRIPTIONS,
      });
      this.connection = 'connected';
      this.error = '';
      await this.refreshStreamStatus();
      await this.refreshReplayBufferStatus();
      await this.refreshStudioModeWarning();
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

  async refreshStudioModeWarning() {
    if (this.connection !== 'connected') {
      return;
    }
    try {
      const { studioModeEnabled } = await this.obs.call('GetStudioModeEnabled');
      this.studioModeWarning = studioModeEnabled
        ? 'OBS Studio Mode is ON. Instant Replay v1 sets the program scene directly — turn Studio Mode off.'
        : '';
      this.emit();
    } catch {
      // Older builds / transient — leave warning empty.
    }
  }

  /** @param {{ silent?: boolean }} [opts] */
  async disconnect(opts = {}) {
    this.stopStatusPoll();
    this.clearWatchdog();
    this.rejectPendingSave(new Error('Disconnected from OBS.'));
    this.isReplaying = false;
    this.instantReplayPhase = 'idle';
    this.liveSceneBeforeReplay = null;
    try {
      await this.obs.disconnect();
    } catch {
      // already closed
    }
    this.connection = 'disconnected';
    this.error = '';
    this.stream = emptyStreamStatus();
    this.replayBufferState = 'unknown';
    this.studioModeWarning = '';
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
    }
  }

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

  /**
   * Wait for ReplayBufferSaved; fall back to GetLastReplayBufferReplay once.
   * @returns {Promise<string>}
   */
  waitForSavedReplayPath() {
    return new Promise((resolve, reject) => {
      let settled = false;
      /** @type {ReturnType<typeof setTimeout> | null} */
      let fallbackTimer = null;
      /** @type {ReturnType<typeof setTimeout> | null} */
      let timeoutTimer = null;

      const cleanup = () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (this.pendingSaveResolve === onEvent) {
          this.pendingSaveResolve = null;
          this.pendingSaveReject = null;
        }
      };

      /** @param {string} path */
      const finish = (path) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(path);
      };

      /** @param {Error} err */
      const fail = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };

      const onEvent = (path) => {
        finish(path);
      };

      this.pendingSaveResolve = onEvent;
      this.pendingSaveReject = fail;

      fallbackTimer = setTimeout(() => {
        void (async () => {
          if (settled) return;
          try {
            const result = await this.obs.call('GetLastReplayBufferReplay');
            const path =
              typeof result?.savedReplayPath === 'string' ? result.savedReplayPath.trim() : '';
            if (path) {
              finish(path);
            }
          } catch {
            // Keep waiting for the event until timeout.
          }
        })();
      }, SAVE_FALLBACK_DELAY_MS);

      timeoutTimer = setTimeout(() => {
        fail(new Error('Timed out waiting for the replay buffer save path from OBS.'));
      }, SAVE_EVENT_WAIT_MS);
    });
  }

  async getCurrentProgramSceneName() {
    try {
      const result = await this.obs.call('GetCurrentProgramScene');
      const name =
        typeof result?.currentProgramSceneName === 'string'
          ? result.currentProgramSceneName.trim()
          : '';
      return name || this.replayScenes.liveSceneName;
    } catch {
      return this.replayScenes.liveSceneName;
    }
  }

  /**
   * Instant Replay: save buffer → load clip into Replay Media → switch scene → restart.
   */
  async startInstantReplay() {
    if (this.connection !== 'connected') {
      throw new Error('Not connected to OBS.');
    }
    if (this.isReplaying || this.instantReplayPhase !== 'idle') {
      return;
    }
    if (!this.replayBufferActive) {
      throw new Error('Replay buffer is not active. Start the replay buffer first.');
    }

    await this.refreshStudioModeWarning();

    const { replaySceneName, replayMediaSourceName, liveSceneName } = this.replayScenes;
    this.error = '';
    this.instantReplayPhase = 'saving';
    this.emit();

    let switchedToReplay = false;
    try {
      const liveScene = await this.getCurrentProgramSceneName();

      await this.obs.call('SaveReplayBuffer');
      const savedPath = await this.waitForSavedReplayPath();
      if (!savedPath) {
        throw new Error('OBS saved the replay buffer but did not return a file path.');
      }

      try {
        await this.obs.call('SetInputSettings', {
          inputName: replayMediaSourceName,
          inputSettings: { local_file: savedPath },
          overlay: true,
        });
      } catch (err) {
        throw new Error(
          `Could not set replay media source “${replayMediaSourceName}”: ${describeObsError(err)}. ` +
            'Confirm an ffmpeg source with that exact name exists in the Replay scene.',
        );
      }

      this.liveSceneBeforeReplay = liveScene || liveSceneName;
      this.isReplaying = true;
      this.instantReplayPhase = 'playing';
      this.emit();

      try {
        await this.obs.call('SetCurrentProgramScene', { sceneName: replaySceneName });
        switchedToReplay = true;
      } catch (err) {
        this.isReplaying = false;
        this.instantReplayPhase = 'idle';
        this.liveSceneBeforeReplay = null;
        throw new Error(
          `Could not switch to scene “${replaySceneName}”: ${describeObsError(err)}. ` +
            'Create a scene named exactly “Replay” in OBS.',
        );
      }

      try {
        await this.obs.call('TriggerMediaInputAction', {
          inputName: replayMediaSourceName,
          mediaAction: MEDIA_RESTART,
        });
      } catch (err) {
        await this.forceReturnToLiveAfterFailure();
        throw new Error(
          `Could not restart replay media “${replayMediaSourceName}”: ${describeObsError(err)}`,
        );
      }

      this.clearWatchdog();
      this.watchdogTimer = setTimeout(() => {
        if (this.isReplaying) {
          void this.returnToLive({ reason: 'watchdog' });
        }
      }, INSTANT_REPLAY_WATCHDOG_MS);

      this.error = '';
      this.emit();
    } catch (err) {
      this.instantReplayPhase = 'idle';
      if (switchedToReplay || this.isReplaying) {
        await this.forceReturnToLiveAfterFailure();
      }
      this.isReplaying = false;
      this.liveSceneBeforeReplay = null;
      this.error = err instanceof Error ? err.message : describeObsError(err);
      this.emit();
      throw new Error(this.error);
    }
  }

  async forceReturnToLiveAfterFailure() {
    const target = this.liveSceneBeforeReplay || this.replayScenes.liveSceneName;
    this.clearWatchdog();
    try {
      await this.obs.call('SetCurrentProgramScene', { sceneName: target });
    } catch {
      try {
        await this.obs.call('SetCurrentProgramScene', {
          sceneName: this.replayScenes.liveSceneName,
        });
      } catch {
        // Best effort — surface original error to the operator.
      }
    }
    this.isReplaying = false;
    this.instantReplayPhase = 'idle';
    this.liveSceneBeforeReplay = null;
    this.emit();
  }

  /**
   * Return program to the live scene and clear replay state.
   * @param {{ reason?: string }} [opts]
   */
  async returnToLive(opts = {}) {
    if (this.connection !== 'connected') {
      throw new Error('Not connected to OBS.');
    }
    if (!this.isReplaying && this.instantReplayPhase === 'idle') {
      return;
    }

    this.clearWatchdog();
    const target = this.liveSceneBeforeReplay || this.replayScenes.liveSceneName;
    try {
      await this.obs.call('SetCurrentProgramScene', { sceneName: target });
      this.isReplaying = false;
      this.instantReplayPhase = 'idle';
      this.liveSceneBeforeReplay = null;
      this.error = '';
      this.emit();
    } catch (err) {
      this.error = `Could not return to live scene “${target}”: ${describeObsError(err)}`;
      // Still clear the latch so the operator can retry Back to Live / Instant Replay.
      this.isReplaying = false;
      this.instantReplayPhase = 'idle';
      this.emit();
      throw new Error(this.error);
    }
    void opts.reason;
  }
}

module.exports = {
  ObsController,
  describeObsError,
  isRetryableObsError,
  REPLAY_BUFFER_SECONDS,
  INSTANT_REPLAY_WATCHDOG_MS,
};
