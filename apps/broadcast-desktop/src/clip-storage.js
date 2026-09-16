/**
 * Nested clip / highlight paths under Electron userData/clips.
 *
 *   <matchId>-<YYYYMMDD-HHMMSS>/
 *     <matchId>-<teamId>/
 *       <paddedOver>.<ball>.mp4   (or …-2.mp4 on collision)
 *     <matchId>-1stinning.mp4
 *     <matchId>-fullhighlight.mp4
 */

const fs = require('node:fs');
const path = require('node:path');

const EXTERNAL_TEAM_ID = 'external';

/**
 * @param {string} raw
 * @returns {string}
 */
function sanitizeId(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return 'unknown';
  }
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * @param {string} userDataDir
 * @returns {string}
 */
function clipsRoot(userDataDir) {
  return path.join(userDataDir, 'clips');
}

/**
 * @param {string} userDataDir
 * @param {string} matchId
 * @param {string} matchFolderStamp  YYYYMMDD-HHMMSS
 * @returns {string}
 */
function matchFolderPath(userDataDir, matchId, matchFolderStamp) {
  const id = sanitizeId(matchId);
  const stamp = String(matchFolderStamp || '00000000-000000').replace(/[^0-9-]/g, '');
  return path.join(clipsRoot(userDataDir), `${id}-${stamp}`);
}

/**
 * @param {string} matchRoot
 * @param {string} matchId
 * @param {string | null | undefined} battingTeamId
 * @returns {string}
 */
function teamFolderPath(matchRoot, matchId, battingTeamId) {
  const teamPart =
    battingTeamId && String(battingTeamId).trim()
      ? sanitizeId(battingTeamId)
      : EXTERNAL_TEAM_ID;
  return path.join(matchRoot, `${sanitizeId(matchId)}-${teamPart}`);
}

/**
 * @param {number | null | undefined} overNumber
 * @param {number | null | undefined} ballNumber
 * @param {number | null | undefined} sequence
 * @returns {string} base name without extension (e.g. "004.3" or "seq-12")
 */
function ballFileBase(overNumber, ballNumber, sequence) {
  if (
    typeof overNumber === 'number' &&
    Number.isFinite(overNumber) &&
    typeof ballNumber === 'number' &&
    Number.isFinite(ballNumber)
  ) {
    const over = Math.trunc(overNumber);
    const ball = Math.trunc(ballNumber);
    return `${String(over).padStart(3, '0')}.${ball}`;
  }
  if (typeof sequence === 'number' && Number.isFinite(sequence)) {
    return `seq-${Math.trunc(sequence)}`;
  }
  return 'seq-unknown';
}

/**
 * Pick a free path: base.mp4, then base-2.mp4, base-3.mp4, …
 * @param {string} teamDir
 * @param {string} baseName  without .mp4
 * @returns {string} absolute destination path
 */
function allocateClipPath(teamDir, baseName) {
  const first = path.join(teamDir, `${baseName}.mp4`);
  if (!fs.existsSync(first)) {
    return first;
  }
  let n = 2;
  for (;;) {
    const candidate = path.join(teamDir, `${baseName}-${n}.mp4`);
    if (!fs.existsSync(candidate)) {
      return candidate;
    }
    n += 1;
  }
}

/**
 * Move OBS-saved replay into the nested match/team folder.
 * @param {{
 *   userDataDir: string,
 *   savedPath: string,
 *   matchId: string,
 *   matchFolderStamp: string,
 *   battingTeamId?: string | null,
 *   overNumber?: number | null,
 *   ballNumber?: number | null,
 *   sequence?: number | null,
 * }} opts
 * @returns {string} final absolute path
 */
function relocateSavedClip(opts) {
  const savedPath = typeof opts.savedPath === 'string' ? opts.savedPath.trim() : '';
  if (!savedPath) {
    throw new Error('OBS saved path is empty.');
  }
  if (!fs.existsSync(savedPath)) {
    throw new Error(`OBS saved file not found: ${savedPath}`);
  }

  const matchId = sanitizeId(opts.matchId);
  const matchRoot = matchFolderPath(opts.userDataDir, matchId, opts.matchFolderStamp);
  const teamDir = teamFolderPath(matchRoot, matchId, opts.battingTeamId);
  fs.mkdirSync(teamDir, { recursive: true });

  const base = ballFileBase(opts.overNumber, opts.ballNumber, opts.sequence);
  const dest = allocateClipPath(teamDir, base);

  try {
    fs.renameSync(savedPath, dest);
  } catch (err) {
    // Cross-device rename can fail — copy then unlink.
    fs.copyFileSync(savedPath, dest);
    try {
      fs.unlinkSync(savedPath);
    } catch {
      // leave original if unlink fails
    }
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[clip-storage] rename fell back to copy: ${message}`);
  }

  return dest;
}

/**
 * @param {'innings-1' | 'full-match'} kind
 * @returns {string}
 */
function highlightFileName(matchId, kind) {
  const id = sanitizeId(matchId);
  return kind === 'full-match' ? `${id}-fullhighlight.mp4` : `${id}-1stinning.mp4`;
}

/**
 * @param {string} userDataDir
 * @param {string} matchId
 * @param {string} matchFolderStamp
 * @param {'innings-1' | 'full-match'} kind
 * @returns {string}
 */
function highlightOutputPath(userDataDir, matchId, matchFolderStamp, kind) {
  const matchRoot = matchFolderPath(userDataDir, matchId, matchFolderStamp);
  return path.join(matchRoot, highlightFileName(matchId, kind));
}

module.exports = {
  EXTERNAL_TEAM_ID,
  sanitizeId,
  clipsRoot,
  matchFolderPath,
  teamFolderPath,
  ballFileBase,
  allocateClipPath,
  relocateSavedClip,
  highlightFileName,
  highlightOutputPath,
};
