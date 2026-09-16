/**
 * Shared highlight concat: ordered local clips → one file via ffmpeg.
 * Kinds: innings-1 | full-match. Runs in the Electron main process only.
 * Output: match-folder root
 *   <matchId>-1stinning.mp4 | <matchId>-fullhighlight.mp4
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { highlightOutputPath } = require('./clip-storage');

/** @typedef {'innings-1' | 'full-match'} HighlightKind */

/**
 * Escape a path for ffmpeg concat demuxer file list.
 * @param {string} filePath
 */
function concatListLine(filePath) {
  const escaped = filePath.replace(/'/g, `'\\''`);
  return `file '${escaped}'`;
}

/**
 * Resolve ffmpeg binary (bundled ffmpeg-static, then PATH).
 * @returns {string}
 */
function resolveFfmpegPath() {
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const bundled = require('ffmpeg-static');
    if (typeof bundled === 'string' && bundled && fs.existsSync(bundled)) {
      return bundled;
    }
  } catch {
    // fall through
  }
  return 'ffmpeg';
}

/**
 * @param {string} ffmpegBin
 * @param {string[]} args
 * @returns {Promise<void>}
 */
function runFfmpeg(ffmpegBin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (err) => {
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

/**
 * Concatenate full clips in order into a single highlight file.
 * Missing paths are skipped (warned). Zero clips → no output. One clip → copy.
 *
 * @param {{
 *   matchId: string,
 *   matchFolderStamp: string,
 *   clipPaths: string[],
 *   kind?: HighlightKind,
 *   userDataDir: string,
 * }} opts
 * @returns {Promise<{
 *   highlightPath: string | null,
 *   clipCount: number,
 *   skipped: number,
 *   status: 'ready' | 'empty' | 'error',
 *   kind: HighlightKind,
 *   error?: string,
 * }>}
 */
async function buildHighlight(opts) {
  const matchId = typeof opts.matchId === 'string' ? opts.matchId.trim() : '';
  const matchFolderStamp =
    typeof opts.matchFolderStamp === 'string' ? opts.matchFolderStamp.trim() : '';
  const userDataDir = opts.userDataDir;
  const kind = opts.kind === 'full-match' ? 'full-match' : 'innings-1';
  const rawPaths = Array.isArray(opts.clipPaths) ? opts.clipPaths : [];
  const logTag = kind === 'full-match' ? 'full-match-highlight' : 'innings-highlight';

  if (!matchId) {
    return {
      highlightPath: null,
      clipCount: 0,
      skipped: 0,
      status: 'error',
      kind,
      error: 'matchId is required',
    };
  }
  if (!matchFolderStamp) {
    return {
      highlightPath: null,
      clipCount: 0,
      skipped: 0,
      status: 'error',
      kind,
      error: 'matchFolderStamp is required',
    };
  }

  const existing = [];
  let skipped = 0;
  for (const p of rawPaths) {
    const filePath = typeof p === 'string' ? p.trim() : '';
    if (!filePath) {
      skipped += 1;
      continue;
    }
    if (fs.existsSync(filePath)) {
      existing.push(filePath);
    } else {
      skipped += 1;
      console.warn(`[${logTag}] skipping missing clip: ${filePath}`);
    }
  }

  const outPath = highlightOutputPath(userDataDir, matchId, matchFolderStamp, kind);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  if (existing.length === 0) {
    try {
      if (fs.existsSync(outPath)) {
        fs.unlinkSync(outPath);
      }
    } catch {
      // ignore
    }
    return {
      highlightPath: null,
      clipCount: 0,
      skipped,
      status: 'empty',
      kind,
    };
  }

  try {
    if (existing.length === 1) {
      fs.copyFileSync(existing[0], outPath);
      return {
        highlightPath: outPath,
        clipCount: 1,
        skipped,
        status: 'ready',
        kind,
      };
    }

    const listPath = path.join(
      os.tmpdir(),
      `asc-highlight-${kind}-${matchId.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`,
    );
    fs.writeFileSync(listPath, existing.map(concatListLine).join('\n'), 'utf8');

    const ffmpegBin = resolveFfmpegPath();
    try {
      await runFfmpeg(ffmpegBin, [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
        '-c',
        'copy',
        outPath,
      ]);
    } catch (copyErr) {
      console.warn(
        `[${logTag}] concat -c copy failed, re-encoding:`,
        copyErr instanceof Error ? copyErr.message : copyErr,
      );
      await runFfmpeg(ffmpegBin, [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        outPath,
      ]);
    }

    try {
      fs.unlinkSync(listPath);
    } catch {
      // ignore
    }

    return {
      highlightPath: outPath,
      clipCount: existing.length,
      skipped,
      status: 'ready',
      kind,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[${logTag}] build failed:`, message);
    return {
      highlightPath: null,
      clipCount: existing.length,
      skipped,
      status: 'error',
      kind,
      error: message,
    };
  }
}

/** @deprecated Use {@link buildHighlight} with kind: 'innings-1'. */
async function buildInningsHighlight(opts) {
  return buildHighlight({ ...opts, kind: 'innings-1' });
}

/**
 * @param {string} userDataDir
 * @param {string} matchId
 * @param {string} matchFolderStamp
 * @param {HighlightKind} [kind]
 * @returns {string | null}
 */
function readExistingHighlightPath(userDataDir, matchId, matchFolderStamp, kind = 'innings-1') {
  if (!matchFolderStamp) {
    return null;
  }
  const outPath = highlightOutputPath(userDataDir, matchId, matchFolderStamp, kind);
  if (fs.existsSync(outPath)) {
    return outPath;
  }
  return null;
}

module.exports = {
  buildHighlight,
  buildInningsHighlight,
  highlightOutputPath,
  readExistingHighlightPath,
  resolveFfmpegPath,
};
