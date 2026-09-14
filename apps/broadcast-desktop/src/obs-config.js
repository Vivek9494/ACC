/**
 * Persist OBS connection + launch settings in app userData.
 * Password is stored locally for the operator — never hardcoded.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = Object.freeze({
  host: '127.0.0.1',
  port: 4455,
  password: '',
  obsAppPath: '/Applications/OBS.app',
  sceneCollection: '',
  profile: '',
});

/** @param {string} userDataDir */
function configPath(userDataDir) {
  return path.join(userDataDir, 'obs-connection.json');
}

/**
 * Accept either the .app bundle or the inner MacOS/OBS binary.
 * @param {string} input
 */
function resolveObsAppPath(input) {
  const trimmed = typeof input === 'string' && input.trim() ? input.trim() : DEFAULTS.obsAppPath;
  if (trimmed.endsWith(`${path.sep}Contents${path.sep}MacOS${path.sep}OBS`)) {
    return path.resolve(trimmed, '..', '..', '..');
  }
  return trimmed;
}

/** @param {string} appPath */
function obsBinaryPath(appPath) {
  return path.join(resolveObsAppPath(appPath), 'Contents', 'MacOS', 'OBS');
}

/** @param {string} appPath */
function obsAppExists(appPath) {
  return fs.existsSync(obsBinaryPath(appPath));
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
  return { host, port, password, obsAppPath, sceneCollection, profile };
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
};
