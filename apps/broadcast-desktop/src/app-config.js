/**
 * Where the scoring cockpit (Expo web) is loaded from.
 * Packaged builds use the hosted cockpit; `electron .` uses the local Expo web server.
 * ASC_COCKPIT_URL overrides either (origin only — path/query are ignored).
 */

const PRODUCTION_COCKPIT_URL = 'https://acc-cockpit.netlify.app';
const DEV_COCKPIT_URL = 'http://localhost:8081';

/**
 * @param {{ isPackaged: boolean, override?: string }} opts
 * @returns {string} origin, e.g. https://acc-cockpit.netlify.app
 */
function resolveCockpitOrigin(opts) {
  const raw = opts.override?.trim() || (opts.isPackaged ? PRODUCTION_COCKPIT_URL : DEV_COCKPIT_URL);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`ASC_COCKPIT_URL is not a valid URL: ${raw}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`ASC_COCKPIT_URL must be http(s): ${raw}`);
  }
  if (opts.isPackaged && url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error(`Packaged builds require an https cockpit URL: ${raw}`);
  }
  return url.origin;
}

module.exports = { PRODUCTION_COCKPIT_URL, DEV_COCKPIT_URL, resolveCockpitOrigin };
