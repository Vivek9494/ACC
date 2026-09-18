/**
 * obs-websocket v5 control layer (Steps 2–3 + Instant Replay).
 * Confirmed protocol names:
 *   GetStreamStatus / StartStream / StopStream / StreamStateChanged
 *   GetReplayBufferStatus / StartReplayBuffer / ReplayBufferStateChanged
 *   SaveReplayBuffer / ReplayBufferSaved / GetLastReplayBufferReplay
 *   SetInputSettings / SetCurrentProgramScene / TriggerMediaInputAction
 *   MediaInputPlaybackEnded / GetStudioModeEnabled
 *   GetProfileParameter / SetProfileParameter (RecRB enable)
 *   GetInputList / CreateInput / SetSceneItemTransform / SetSceneItemIndex (ASC Overlay)
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

/** Fixed browser-source name for the scoring overlay (idempotent by name). */
const ASC_OVERLAY_INPUT_NAME = 'ASC Overlay';
const ASC_OVERLAY_WIDTH = 1920;
const ASC_OVERLAY_HEIGHT = 1080;
const ASC_OVERLAY_CSS =
  'body { background-color: rgba(0,0,0,0) !important; margin: 0px; overflow: hidden; }';

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
/** @typedef {'instant_replay' | 'boundary'} ReplaySavePurpose */
/**
 * @typedef {{
 *   purpose: ReplaySavePurpose,
 *   deliveryId: string | null,
 *   resolve: (path: string) => void,
 *   reject: (err: Error) => void,
 *   timeoutTimer: ReturnType<typeof setTimeout> | null,
 *   fallbackTimer: ReturnType<typeof setTimeout> | null,
 * }} PendingReplaySave
 */

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
    /** @type {{ overlaySceneName: string, overlayUrlBase: string }} */
    this.overlayConfig = {
      overlaySceneName: DEFAULTS.overlaySceneName,
      overlayUrlBase: DEFAULTS.overlayUrlBase,
    };
    /** @type {string | null} */
    this.liveSceneBeforeReplay = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.watchdogTimer = null;
    /** Purpose-tagged FIFO of in-flight SaveReplayBuffer waits. */
    /** @type {PendingReplaySave[]} */
    this.pendingSaves = [];
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
   * @param {{
   *   liveSceneName?: string,
   *   replaySceneName?: string,
   *   replayMediaSourceName?: string,
   *   overlaySceneName?: string,
   *   overlayUrlBase?: string,
   * }} config
   */
  applyReplaySceneConfig(config) {
    this.replayScenes = {
      liveSceneName: config.liveSceneName || DEFAULTS.liveSceneName,
      replaySceneName: config.replaySceneName || DEFAULTS.replaySceneName,
      replayMediaSourceName: config.replayMediaSourceName || DEFAULTS.replayMediaSourceName,
    };
    const overlayBase =
      typeof config.overlayUrlBase === 'string' && config.overlayUrlBase.trim()
        ? config.overlayUrlBase.trim().replace(/\/$/, '')
        : DEFAULTS.overlayUrlBase;
    this.overlayConfig = {
      overlaySceneName: config.overlaySceneName || DEFAULTS.overlaySceneName,
      overlayUrlBase: overlayBase,
    };
  }

  /**
   * Build overlay page URL for a match: `{base}/?matchId=…`.
   * @param {string} matchId
   */
  overlayUrlForMatch(matchId) {
    const base = this.overlayConfig.overlayUrlBase || DEFAULTS.overlayUrlBase;
    const params = new URLSearchParams({ matchId });
    return `${base}/?${params.toString()}`;
  }

  /**
   * Ensure browser source "ASC Overlay" exists in the configured scene and points
   * at this match. Idempotent: update URL only when present; create+size+layer once.
   * No-op when OBS is not connected.
   * @param {string} matchId
   * @returns {Promise<{ action: 'skipped' | 'updated' | 'created', reason?: string }>}
   */
  async ensureAscOverlay(matchId) {
    const id = typeof matchId === 'string' ? matchId.trim() : '';
    if (!id) {
      return { action: 'skipped', reason: 'no-match-id' };
    }
    if (this.connection !== 'connected') {
      return { action: 'skipped', reason: 'not-connected' };
    }

    const url = this.overlayUrlForMatch(id);
    const sceneName = this.overlayConfig.overlaySceneName || DEFAULTS.overlaySceneName;

    let exists = false;
    try {
      const { inputs } = await this.obs.call('GetInputList');
      exists = Array.isArray(inputs)
        ? inputs.some((input) => input && input.inputName === ASC_OVERLAY_INPUT_NAME)
        : false;
    } catch (err) {
      throw new Error(`Could not list OBS inputs: ${describeObsError(err)}`);
    }

    if (exists) {
      try {
        await this.obs.call('SetInputSettings', {
          inputName: ASC_OVERLAY_INPUT_NAME,
          inputSettings: { url },
          overlay: true,
        });
        console.info(`[OBS] Updated “${ASC_OVERLAY_INPUT_NAME}” URL for match ${id}`);
        return { action: 'updated' };
      } catch (err) {
        throw new Error(
          `Could not update “${ASC_OVERLAY_INPUT_NAME}”: ${describeObsError(err)}`,
        );
      }
    }

    /** @type {{ sceneItemId?: number }} */
    let created;
    try {
      created = await this.obs.call('CreateInput', {
        sceneName,
        inputName: ASC_OVERLAY_INPUT_NAME,
        inputKind: 'browser_source',
        inputSettings: {
          url,
          width: ASC_OVERLAY_WIDTH,
          height: ASC_OVERLAY_HEIGHT,
          css: ASC_OVERLAY_CSS,
          fps: 30,
          shutdown: false,
          restart_when_active: true,
        },
        sceneItemEnabled: true,
      });
    } catch (err) {
      throw new Error(
        `Could not create “${ASC_OVERLAY_INPUT_NAME}” in scene “${sceneName}”: ${describeObsError(err)}`,
      );
    }

    const sceneItemId = created?.sceneItemId;
    if (typeof sceneItemId === 'number') {
      try {
        await this.obs.call('SetSceneItemTransform', {
          sceneName,
          sceneItemId,
          sceneItemTransform: {
            positionX: 0,
            positionY: 0,
            alignment: 5,
            boundsType: 'OBS_BOUNDS_STRETCH',
            boundsAlignment: 0,
            boundsWidth: ASC_OVERLAY_WIDTH,
            boundsHeight: ASC_OVERLAY_HEIGHT,
          },
        });
      } catch (err) {
        console.warn(
          `[OBS] Created “${ASC_OVERLAY_INPUT_NAME}” but could not set transform:`,
          describeObsError(err),
        );
      }

      try {
        const { sceneItems } = await this.obs.call('GetSceneItemList', { sceneName });
        const topIndex = Array.isArray(sceneItems) ? Math.max(0, sceneItems.length - 1) : 0;
        await this.obs.call('SetSceneItemIndex', {
          sceneName,
          sceneItemId,
          sceneItemIndex: topIndex,
        });
      } catch (err) {
        console.warn(
          `[OBS] Created “${ASC_OVERLAY_INPUT_NAME}” but could not set z-order:`,
          describeObsError(err),
        );
      }
    }

    console.info(
      `[OBS] Created “${ASC_OVERLAY_INPUT_NAME}” in “${sceneName}” for match ${id}`,
    );
    return { action: 'created' };
  }

  bindEvents() {
    if (this.bound) {
      return;
    }
    this.bound = true;

    this.obs.on('ConnectionClosed', (err) => {
      this.stopStatusPoll();
      this.clearWatchdog();
      this.rejectAllPendingSaves(new Error('OBS connection closed while saving the replay.'));
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
      this.rejectAllPendingSaves(new Error(describeObsError(err)));
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
      this.resolveOldestPendingSave(savedPath);
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

  /**
   * @param {PendingReplaySave} entry
   */
  clearPendingTimers(entry) {
    if (entry.timeoutTimer) {
      clearTimeout(entry.timeoutTimer);
      entry.timeoutTimer = null;
    }
    if (entry.fallbackTimer) {
      clearTimeout(entry.fallbackTimer);
      entry.fallbackTimer = null;
    }
  }

  /**
   * @param {PendingReplaySave} entry
   */
  removePendingSave(entry) {
    const idx = this.pendingSaves.indexOf(entry);
    if (idx >= 0) {
      this.pendingSaves.splice(idx, 1);
    }
    this.clearPendingTimers(entry);
  }

  /**
   * @param {string} path
   */
  resolveOldestPendingSave(path) {
    const entry = this.pendingSaves.shift();
    if (!entry) {
      return;
    }
    this.clearPendingTimers(entry);
    entry.resolve(path);
  }

  /**
   * @param {Error} err
   */
  rejectAllPendingSaves(err) {
    const pending = this.pendingSaves.splice(0, this.pendingSaves.length);
    for (const entry of pending) {
      this.clearPendingTimers(entry);
      entry.reject(err);
    }
  }

  /**
   * Enqueue a purpose-tagged wait for the next ReplayBufferSaved (FIFO).
   * @param {ReplaySavePurpose} purpose
   * @param {string | null} [deliveryId]
   * @returns {Promise<string>}
   */
  enqueuePendingSave(purpose, deliveryId = null) {
    return new Promise((resolve, reject) => {
      /** @type {PendingReplaySave} */
      const entry = {
        purpose,
        deliveryId: deliveryId && deliveryId.trim() ? deliveryId.trim() : null,
        resolve,
        reject,
        timeoutTimer: null,
        fallbackTimer: null,
      };

      entry.fallbackTimer = setTimeout(() => {
        void (async () => {
          if (!this.pendingSaves.includes(entry)) {
            return;
          }
          // Only the oldest waiter may consume GetLast — avoids stealing a later save.
          if (this.pendingSaves[0] !== entry) {
            return;
          }
          try {
            const result = await this.obs.call('GetLastReplayBufferReplay');
            const path =
              typeof result?.savedReplayPath === 'string' ? result.savedReplayPath.trim() : '';
            if (path && this.pendingSaves[0] === entry) {
              this.resolveOldestPendingSave(path);
            }
          } catch {
            // Keep waiting for the event until timeout.
          }
        })();
      }, SAVE_FALLBACK_DELAY_MS);

      entry.timeoutTimer = setTimeout(() => {
        if (!this.pendingSaves.includes(entry)) {
          return;
        }
        this.removePendingSave(entry);
        const label =
          purpose === 'boundary'
            ? `boundary clip${entry.deliveryId ? ` (${entry.deliveryId})` : ''}`
            : 'instant replay';
        console.warn(`[OBS] Timed out waiting for ReplayBufferSaved for ${label}`);
        reject(new Error(`Timed out waiting for the replay buffer save path from OBS (${purpose}).`));
      }, SAVE_EVENT_WAIT_MS);

      this.pendingSaves.push(entry);
    });
  }

  /**
   * Save the replay buffer and resolve with path for a tagged purpose.
   * @param {ReplaySavePurpose} purpose
   * @param {string | null} [deliveryId]
   * @returns {Promise<string>}
   */
  async saveReplayBuffer(purpose, deliveryId = null) {
    if (this.connection !== 'connected') {
      throw new Error('Not connected to OBS.');
    }
    if (!this.replayBufferActive) {
      throw new Error('Replay buffer is not active. Start the replay buffer first.');
    }
    const pathPromise = this.enqueuePendingSave(purpose, deliveryId);
    try {
      await this.obs.call('SaveReplayBuffer');
    } catch (err) {
      // Fail the entry we just enqueued (last in queue).
      const entry = this.pendingSaves[this.pendingSaves.length - 1];
      if (entry && entry.purpose === purpose && entry.deliveryId === (deliveryId?.trim() || null)) {
        this.removePendingSave(entry);
        entry.reject(new Error(describeObsError(err)));
      }
      throw new Error(describeObsError(err));
    }
    return pathPromise;
  }

  /**
   * Boundary auto-clip: save buffer, relocate into nested match/team folder.
   * @param {{
   *   deliveryId?: string,
   *   matchId?: string,
   *   matchFolderStamp?: string,
   *   battingTeamId?: string | null,
   *   overNumber?: number | null,
   *   ballNumber?: number | null,
   *   sequence?: number | null,
   * } | string} payload  string = legacy deliveryId-only
   * @param {string} [userDataDir]
   * @returns {Promise<{ deliveryId: string, videoPath: string }>}
   */
  async saveBoundaryClip(payload, userDataDir) {
    const meta =
      typeof payload === 'string'
        ? { deliveryId: payload }
        : payload && typeof payload === 'object'
          ? payload
          : {};
    const id = typeof meta.deliveryId === 'string' ? meta.deliveryId.trim() : '';
    if (!id) {
      throw new Error('deliveryId is required for a boundary clip.');
    }
    const savedPath = await this.saveReplayBuffer('boundary', id);
    if (!savedPath) {
      throw new Error('OBS saved the replay buffer but did not return a file path.');
    }

    const matchId = typeof meta.matchId === 'string' ? meta.matchId.trim() : '';
    const matchFolderStamp =
      typeof meta.matchFolderStamp === 'string' ? meta.matchFolderStamp.trim() : '';
    const dataDir = typeof userDataDir === 'string' ? userDataDir.trim() : '';

    // Without folder context, leave the OBS path as-is (legacy / miswired callers).
    if (!matchId || !matchFolderStamp || !dataDir) {
      return { deliveryId: id, videoPath: savedPath };
    }

    const { relocateSavedClip } = require('./clip-storage');
    const videoPath = relocateSavedClip({
      userDataDir: dataDir,
      savedPath,
      matchId,
      matchFolderStamp,
      battingTeamId: meta.battingTeamId ?? null,
      overNumber: meta.overNumber ?? null,
      ballNumber: meta.ballNumber ?? null,
      sequence: meta.sequence ?? null,
    });
    return { deliveryId: id, videoPath };
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
   *   overlaySceneName?: string,
   *   overlayUrlBase?: string,
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
    this.rejectAllPendingSaves(new Error('Disconnected from OBS.'));
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

  /** True while Instant Replay is saving or any clip owns the Replay scene. */
  isOnAirReplayBusy() {
    return this.isReplaying || this.instantReplayPhase !== 'idle';
  }

  /**
   * Shared on-air engine: load a local file into Replay Media, cut to Replay, restart from
   * the start, auto-return on MediaInputPlaybackEnded (matching source) or watchdog.
   * Sets/clears the shared isReplaying lock. Does NOT save the replay buffer.
   * @param {string} filePath
   * @param {{ liveSceneName?: string | null, continueFromSave?: boolean }} [opts]
   */
  async playFileOnAir(filePath, opts = {}) {
    if (this.connection !== 'connected') {
      throw new Error('Not connected to OBS.');
    }
    const path = typeof filePath === 'string' ? filePath.trim() : '';
    if (!path) {
      throw new Error('A local clip path is required to play on air.');
    }
    // Instant Replay holds phase=saving across SaveReplayBuffer; allow that handoff only.
    if (opts.continueFromSave) {
      if (this.isReplaying || this.instantReplayPhase !== 'saving') {
        throw new Error('A replay is already on air. Return to live before playing another clip.');
      }
    } else if (this.isOnAirReplayBusy()) {
      throw new Error('A replay is already on air. Return to live before playing another clip.');
    }

    await this.refreshStudioModeWarning();

    const { replaySceneName, replayMediaSourceName, liveSceneName } = this.replayScenes;
    const liveScene =
      (typeof opts.liveSceneName === 'string' && opts.liveSceneName.trim()) ||
      (await this.getCurrentProgramSceneName());

    this.error = '';
    let switchedToReplay = false;

    try {
      try {
        await this.obs.call('SetInputSettings', {
          inputName: replayMediaSourceName,
          inputSettings: { local_file: path },
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

  /**
   * Play an already-captured delivery clip on air (no SaveReplayBuffer).
   * @param {{ videoPath?: string, deliveryId?: string }} payload
   */
  async playDeliveryClip(payload = {}) {
    const videoPath =
      typeof payload.videoPath === 'string' ? payload.videoPath.trim() : '';
    if (!videoPath) {
      throw new Error('videoPath is required to play a delivery clip.');
    }
    if (this.isOnAirReplayBusy()) {
      throw new Error('A replay is already on air. Return to live before playing another clip.');
    }
    void payload.deliveryId;
    await this.playFileOnAir(videoPath);
  }

  /**
   * Instant Replay: save buffer → playFileOnAir(savedPath).
   */
  async startInstantReplay() {
    if (this.connection !== 'connected') {
      throw new Error('Not connected to OBS.');
    }
    if (this.isOnAirReplayBusy()) {
      return;
    }
    if (!this.replayBufferActive) {
      throw new Error('Replay buffer is not active. Start the replay buffer first.');
    }

    await this.refreshStudioModeWarning();

    this.error = '';
    this.instantReplayPhase = 'saving';
    this.emit();

    try {
      const liveScene = await this.getCurrentProgramSceneName();

      const savedPath = await this.saveReplayBuffer('instant_replay');
      if (!savedPath) {
        throw new Error('OBS saved the replay buffer but did not return a file path.');
      }

      // Handoff under the same lock (phase stays 'saving' until playFileOnAir latches playing).
      await this.playFileOnAir(savedPath, {
        liveSceneName: liveScene,
        continueFromSave: true,
      });
    } catch (err) {
      this.instantReplayPhase = 'idle';
      if (this.isReplaying) {
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
