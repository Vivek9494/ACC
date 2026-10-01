/**
 * Persist OBS connection + launch + instant-replay settings in app userData.
 * Password is stored locally for the operator — never hardcoded.
 */

const fs = require('node:fs');
const path = require('node:path');

const IS_WINDOWS = process.platform === 'win32';
const WINDOWS_OBS_EXE = 'obs64.exe';

function defaultObsAppPath() {
  if (IS_WINDOWS) {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    return path.win32.join(programFiles, 'obs-studio', 'bin', '64bit', WINDOWS_OBS_EXE);
  }
  return '/Applications/OBS.app';
}

const DEFAULTS = Object.freeze({
  host: '127.0.0.1',
  port: 4455,
  password: '',
  obsAppPath: defaultObsAppPath(),
  sceneCollection: '',
  profile: '',
  /** Program scene used for live broadcast (Instant Replay returns here). */
  liveSceneName: 'Scene',
  /** Full-screen scene that plays the saved replay clip. */
  replaySceneName: 'Replay',
  /** ffmpeg media source inside the replay scene (file left blank in OBS). */
  replayMediaSourceName: 'Replay Media',
  /** Scene that hosts the ASC Overlay browser source. */
  overlaySceneName: 'Scene',
  /** Deployed overlay origin (no trailing slash). */
  overlayUrlBase: 'https://acc-overlay.netlify.app',
});

/** @param {string} userDataDir */
function configPath(userDataDir) {
  return path.join(userDataDir, 'obs-connection.json');
}

/**
 * macOS: the .app bundle (or its inner MacOS/OBS binary).
 * Windows: obs64.exe (or the obs-studio install folder).
 * @param {string} input
 */
function resolveObsAppPath(input) {
  const trimmed = typeof input === 'string' && input.trim() ? input.trim() : DEFAULTS.obsAppPath;
  if (IS_WINDOWS) {
    if (path.extname(trimmed).toLowerCase() === '.exe') {
      return trimmed;
    }
    return path.win32.join(trimmed, 'bin', '64bit', WINDOWS_OBS_EXE);
  }
  if (trimmed.endsWith(`${path.sep}Contents${path.sep}MacOS${path.sep}OBS`)) {
    return path.resolve(trimmed, '..', '..', '..');
  }
  return trimmed;
}

/** Executable that is actually launched. @param {string} appPath */
function obsBinaryPath(appPath) {
  const resolved = resolveObsAppPath(appPath);
  return IS_WINDOWS ? resolved : path.join(resolved, 'Contents', 'MacOS', 'OBS');
}

/**
 * Only launch something that looks like OBS (the path is editable from the cockpit).
 * @param {string} appPath
 */
function obsAppExists(appPath) {
  const binary = obsBinaryPath(appPath);
  if (IS_WINDOWS && path.basename(binary).toLowerCase() !== WINDOWS_OBS_EXE) {
    return false;
  }
  return fs.existsSync(binary);
}

/**
 * Overlay origin pushed into the OBS browser source: http(s) origins only.
 * @param {string} raw
 */
function normalizeOverlayUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return url.origin;
    }
  } catch {
    // fall through
  }
  return DEFAULTS.overlayUrlBase;
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function stringOrDefault(value, fallback) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return fallback;
}

/**
 * @param {unknown} raw
 * @returns {{
 *   host: string,
 *   port: number,
 *   password: string,
 *   obsAppPath: string,
 *   sceneCollection: string,
 *   profile: string,
 *   liveSceneName: string,
 *   replaySceneName: string,
 *   replayMediaSourceName: string,
 *   overlaySceneName: string,
 *   overlayUrlBase: string,
 * }}
 */
function normalizeConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const host =
    typeof source.host === 'string' && source.host.trim()
      ? source.host.trim()
      : DEFAULTS.host;
  const parsedPort = Number.parseInt(String(source.port ?? ''), 10);
  const port =
    Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
      ? parsedPort
      : DEFAULTS.port;
  const password = typeof source.password === 'string' ? source.password : '';
  const obsAppPath = resolveObsAppPath(
    typeof source.obsAppPath === 'string' ? source.obsAppPath : DEFAULTS.obsAppPath,
  );
  const sceneCollection =
    typeof source.sceneCollection === 'string' ? source.sceneCollection.trim() : '';
  const profile = typeof source.profile === 'string' ? source.profile.trim() : '';
  const overlayUrlRaw = stringOrDefault(source.overlayUrlBase, DEFAULTS.overlayUrlBase);
  return {
    host,
    port,
    password,
    obsAppPath,
    sceneCollection,
    profile,
    liveSceneName: stringOrDefault(source.liveSceneName, DEFAULTS.liveSceneName),
    replaySceneName: stringOrDefault(source.replaySceneName, DEFAULTS.replaySceneName),
    replayMediaSourceName: stringOrDefault(
      source.replayMediaSourceName,
      DEFAULTS.replayMediaSourceName,
    ),
    overlaySceneName: stringOrDefault(source.overlaySceneName, DEFAULTS.overlaySceneName),
    overlayUrlBase: normalizeOverlayUrl(overlayUrlRaw),
  };
}

/** @param {string} userDataDir */
function readObsConfig(userDataDir) {
  try {
    const json = fs.readFileSync(configPath(userDataDir), 'utf8');
    return normalizeConfig(JSON.parse(json));
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * @param {string} userDataDir
 * @param {unknown} raw
 */
function writeObsConfig(userDataDir, raw) {
  const config = normalizeConfig(raw);
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(configPath(userDataDir), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return config;
}

module.exports = {
  DEFAULTS,
  normalizeConfig,
  readObsConfig,
  writeObsConfig,
  resolveObsAppPath,
  obsBinaryPath,
  obsAppExists,
  WINDOWS_OBS_EXE,
};
