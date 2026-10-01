/**
 * OBS lifecycle (launch / detect / quit) for macOS and Windows.
 *
 * macOS launch: `open -g -j -a OBS.app --args …` (background, no focus steal).
 * Windows launch: obs64.exe spawned detached with its bin folder as cwd (OBS
 * resolves its data paths relative to the working directory).
 * Flags: --startreplaybuffer, --minimize-to-tray, --disable-missing-files-check,
 * optional --collection / --profile.
 * --disable-shutdown-check is NOT supported (removed in OBS 32) — quit cleanly
 * (AppleScript on macOS, non-forced taskkill on Windows) so the .sentinel file
 * is cleared and OBS does not offer Safe Mode next launch.
 */

const { execFile, spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { promisify } = require('node:util');
const {
  obsAppExists,
  obsBinaryPath,
  resolveObsAppPath,
  WINDOWS_OBS_EXE,
} = require('./obs-config');
const { isRetryableObsError } = require('./obs-client');

const IS_WINDOWS = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

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
  if (IS_WINDOWS) {
    try {
      const { stdout } = await execFileAsync(
        'tasklist',
        ['/FI', `IMAGENAME eq ${WINDOWS_OBS_EXE}`, '/NH', '/FO', 'CSV'],
        { timeout: 4000, windowsHide: true },
      );
      return stdout.toLowerCase().includes(`"${WINDOWS_OBS_EXE}"`);
    } catch {
      return false;
    }
  }
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
  if (!IS_MAC) {
    // Windows: --minimize-to-tray already keeps OBS out of the way.
    return;
  }
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
    if (IS_WINDOWS) {
      // No /F: sends WM_CLOSE so OBS shuts down cleanly.
      await execFileAsync('taskkill', ['/IM', WINDOWS_OBS_EXE], {
        timeout: 8000,
        windowsHide: true,
      });
    } else {
      await execFileAsync('osascript', ['-e', 'tell application "OBS" to quit'], {
        timeout: 8000,
      });
    }
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
  if (!IS_MAC && !IS_WINDOWS) {
    throw new Error('Launching OBS is supported on macOS and Windows only. Start OBS manually.');
  }
  const appPath = resolveObsAppPath(config.obsAppPath);
  if (!obsAppExists(appPath)) {
    throw new Error(
      `OBS was not found at ${appPath}. Set the OBS app path in Settings, or leave it blank for the standard install location.`,
    );
  }

  /** @type {string[]} */
  const obsArgs = ['--startreplaybuffer', '--minimize-to-tray', '--disable-missing-files-check'];
  if (config.sceneCollection) {
    obsArgs.push('--collection', config.sceneCollection);
  }
  if (config.profile) {
    obsArgs.push('--profile', config.profile);
  }

  if (IS_WINDOWS) {
    const exe = obsBinaryPath(appPath);
    await new Promise((resolve, reject) => {
      const child = spawn(exe, obsArgs, {
        cwd: path.dirname(exe),
        detached: true,
        stdio: 'ignore',
      });
      child.once('error', reject);
      child.once('spawn', () => {
        child.unref();
        resolve(undefined);
      });
    });
    return;
  }

  await execFileAsync('open', ['-g', '-j', '-a', appPath, '--args', ...obsArgs], {
    timeout: 8000,
  });
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
