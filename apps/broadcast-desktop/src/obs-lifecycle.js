/**
 * macOS OBS lifecycle (Step 3).
 *
 * Launch: `open -g -j -a OBS.app --args …` (background, no focus steal).
 * Installed OBS 32.2.2 flags used: --startreplaybuffer, --minimize-to-tray,
 * --disable-missing-files-check, optional --collection / --profile.
 * --disable-shutdown-check is NOT supported (removed in OBS 32) — we quit
 * cleanly via AppleScript instead so the .sentinel file is cleared.
 */

const { execFile } = require('node:child_process');
const net = require('node:net');
const { promisify } = require('node:util');
const { obsAppExists, resolveObsAppPath } = require('./obs-config');
const { isRetryableObsError } = require('./obs-client');

const execFileAsync = promisify(execFile);

const CONNECT_TIMEOUT_MS = 30_000;
const CONNECT_INTERVAL_MS = 500;
const QUIT_TIMEOUT_MS = 10_000;

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function isObsProcessRunning() {
  try {
    await execFileAsync('pgrep', ['-x', 'OBS'], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/** @param {number} port */
function isWebsocketListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const done = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(400, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** @param {number} port */
async function isObsAlreadyRunning(port) {
  if (await isObsProcessRunning()) {
    return true;
  }
  return isWebsocketListening(port);
}

async function hideObsWindows() {
  try {
    await execFileAsync(
      'osascript',
      ['-e', 'tell application "System Events" to set visible of process "OBS" to false'],
      { timeout: 4000 },
    );
  } catch {
    // Accessibility / process not ready yet — launch flags already hid it.
  }
}

async function quitObsApp() {
  try {
    await execFileAsync('osascript', ['-e', 'tell application "OBS" to quit'], { timeout: 8000 });
  } catch {
    // Fall through to wait/poll; process may already be exiting.
  }
  const deadline = Date.now() + QUIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!(await isObsProcessRunning())) {
      return;
    }
    await sleep(250);
  }
}

/**
 * @param {{ obsAppPath: string, sceneCollection?: string, profile?: string }} config
 */
async function launchObsApp(config) {
  const appPath = resolveObsAppPath(config.obsAppPath);
  if (!obsAppExists(appPath)) {
    throw new Error(
      `OBS was not found at ${appPath}. Set the OBS app path in Settings (default /Applications/OBS.app).`,
    );
  }

  /** @type {string[]} */
  const args = [
    '-g',
    '-j',
    '-a',
    appPath,
    '--args',
    '--startreplaybuffer',
    '--minimize-to-tray',
    '--disable-missing-files-check',
  ];
  if (config.sceneCollection) {
    args.push('--collection', config.sceneCollection);
  }
  if (config.profile) {
    args.push('--profile', config.profile);
  }

  await execFileAsync('open', args, { timeout: 8000 });
}

/**
 * @param {import('./obs-client').ObsController} obs
 */
class ObsLifecycle {
  /**
   * @param {import('./obs-client').ObsController} obs
   * @param {() => ReturnType<typeof import('./obs-config').readObsConfig>} getConfig
   */
  constructor(obs, getConfig) {
    this.obs = obs;
    this.getConfig = getConfig;
    /** @type {'idle' | 'launching' | 'waiting' | 'error'} */
    this.phase = 'idle';
    this.launchedByApp = false;
    this.lifecycleError = '';
    this.replayBufferWarning = '';
    /** @type {Set<(snapshot: ReturnType<ObsLifecycle['snapshot']>) => void>} */
    this.listeners = new Set();

    this.obs.onChange(() => this.emit());
  }

  /** @param {(snapshot: ReturnType<ObsLifecycle['snapshot']>) => void} listener */
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot() {
    const base = this.obs.snapshot();
    return {
      ...base,
      lifecycle: this.phase,
      launchedByApp: this.launchedByApp,
      replayBufferWarning: this.replayBufferWarning,
      error: this.phase === 'error' && this.lifecycleError ? this.lifecycleError : base.error,
    };
  }

  emit() {
    const snap = this.snapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  setPhase(phase, error = '') {
    this.phase = phase;
    this.lifecycleError = error;
    this.emit();
  }

  /**
   * Launch OBS if needed, wait for websocket, auto-connect, hide, start replay buffer.
   */
  async ensureSession() {
    const config = this.getConfig();
    this.replayBufferWarning = '';

    if (this.obs.connection === 'connected') {
      await this.afterConnected();
      return this.snapshot();
    }

    const alreadyRunning = await isObsAlreadyRunning(config.port);
    if (!alreadyRunning) {
      this.setPhase('launching');
      try {
        await launchObsApp(config);
        this.launchedByApp = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not launch OBS.';
        this.setPhase('error', message);
        throw new Error(message);
      }
    }

    this.setPhase('waiting');
    try {
      await this.connectWithRetry(config);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not connect to OBS.';
      this.setPhase('error', message);
      throw new Error(message);
    }

    this.setPhase('idle');
    await this.afterConnected();
    return this.snapshot();
  }

  /**
   * @param {ReturnType<typeof import('./obs-config').readObsConfig>} config
   */
  async connectWithRetry(config) {
    const deadline = Date.now() + CONNECT_TIMEOUT_MS;
    let lastError = 'OBS websocket did not become ready in time.';

    while (Date.now() < deadline) {
      try {
        await this.obs.connect(config);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (!isRetryableObsError(err)) {
          throw new Error(lastError);
        }
        await sleep(CONNECT_INTERVAL_MS);
      }
    }

    throw new Error(
      `Timed out waiting for OBS websocket at ${config.host}:${config.port}. ${lastError}`,
    );
  }

  async afterConnected() {
    await hideObsWindows();
    try {
      await this.obs.ensureReplayBuffer();
      this.replayBufferWarning = '';
      this.emit();
    } catch (err) {
      this.replayBufferWarning =
        err instanceof Error
          ? err.message
          : 'Could not start the OBS replay buffer. Enable it in OBS → Settings → Output.';
      this.emit();
    }
  }

  /**
   * Stop stream (if asked) and quit only an OBS this app launched.
   * @param {{ stopStream?: boolean }} [opts]
   */
  async shutdown(opts = {}) {
    const stopStream = opts.stopStream !== false;
    if (this.obs.connection === 'connected' && stopStream && this.obs.stream.outputActive) {
      try {
        await this.obs.stopStream();
      } catch {
        // Still try to quit / disconnect.
      }
    }

    if (this.launchedByApp) {
      await quitObsApp();
      this.launchedByApp = false;
    }

    await this.obs.disconnect({ silent: true });
    this.setPhase('idle');
  }
}

module.exports = {
  ObsLifecycle,
  isObsProcessRunning,
  isObsAlreadyRunning,
  launchObsApp,
  hideObsWindows,
  quitObsApp,
};
