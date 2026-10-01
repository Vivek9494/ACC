#!/usr/bin/env node
/**
 * Download the ffmpeg binaries the installer ships (Resources/bin/ffmpeg[.exe]).
 * ffmpeg-static's postinstall only fetches the build machine's arch; a universal
 * macOS app needs both, so packaging pulls every target arch from the same
 * ffmpeg-static release into build/ffmpeg/<os>-<arch>/ (matched by
 * electron-builder's ${os}-${arch} extraResources macro).
 *
 *   node scripts/fetch-ffmpeg.cjs mac   → mac-x64, mac-arm64
 *   node scripts/fetch-ffmpeg.cjs win   → win-x64
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const TARGETS = {
  mac: [
    { os: 'mac', platform: 'darwin', arch: 'x64' },
    { os: 'mac', platform: 'darwin', arch: 'arm64' },
  ],
  win: [{ os: 'win', platform: 'win32', arch: 'x64' }],
};

const OUT_ROOT = path.join(__dirname, '..', 'build', 'ffmpeg');
const LICENSE_DIR = path.join(OUT_ROOT, 'licenses');

function releaseTag() {
  const pkg = require('ffmpeg-static/package.json');
  return process.env.FFMPEG_BINARY_RELEASE || pkg['ffmpeg-static']['binary-release-tag'];
}

/** @param {string} url */
async function download(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** @param {{ os: string, platform: string, arch: string }} target @param {string} baseUrl */
async function fetchTarget(target, baseUrl) {
  const dir = path.join(OUT_ROOT, `${target.os}-${target.arch}`);
  const binary = path.join(dir, target.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(binary) && fs.statSync(binary).size > 0) {
    console.log(`ffmpeg ${target.os}-${target.arch}: cached`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const gz = await download(`${baseUrl}/ffmpeg-${target.platform}-${target.arch}.gz`);
  fs.writeFileSync(binary, zlib.gunzipSync(gz), { mode: 0o755 });
  // Licences live outside the per-arch folder: a universal merge needs every
  // non-binary file to be identical across the x64 and arm64 builds.
  fs.mkdirSync(LICENSE_DIR, { recursive: true });
  const license = await download(`${baseUrl}/${target.platform}-${target.arch}.LICENSE`);
  fs.writeFileSync(path.join(LICENSE_DIR, `ffmpeg-${target.platform}-${target.arch}.LICENSE`), license);
  console.log(`ffmpeg ${target.os}-${target.arch}: ${(fs.statSync(binary).size / 1e6).toFixed(1)} MB`);
}

async function main() {
  const requested = process.argv.slice(2);
  const keys = requested.length > 0 ? requested : [process.platform === 'win32' ? 'win' : 'mac'];
  const unknown = keys.filter((key) => !(key in TARGETS));
  if (unknown.length > 0) {
    throw new Error(`Unknown target(s): ${unknown.join(', ')} (use mac and/or win)`);
  }
  const baseUrl = `${
    process.env.FFMPEG_BINARIES_URL || 'https://github.com/eugeneware/ffmpeg-static/releases/download'
  }/${releaseTag()}`;
  for (const key of keys) {
    for (const target of TARGETS[key]) {
      await fetchTarget(target, baseUrl);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
