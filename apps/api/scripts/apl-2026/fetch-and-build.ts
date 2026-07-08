/**
 * Phase 1 — Fetch APL 2026 team exports and write prisma/seed-data/apl-2026.json.
 * Run: pnpm --filter @acc/api seed:apl2026:fetch
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  normalizeSeedPhone,
  sentinelPhoneFromSourceId,
} from '../../prisma/seeds/apl-2026-phone.util';
import {
  APL_2026_SEED_JSON_PATH,
  APL_2026_TEAM_EXPORT_URLS,
  type Apl2026SeedData,
  type Apl2026SeedPlayer,
  type Apl2026SeedTeam,
} from '../../prisma/seeds/apl-2026.types';

const VALID_ROLES = new Set(['BATSMAN', 'BOWLER', 'ALL_ROUNDER']);

interface SourcePlayer {
  id: string;
  name: string;
  role?: string | null;
  battingRating?: number | null;
  bowlingRating?: number | null;
  fieldingRating?: number | null;
  mandal?: string | null;
  phone?: string | null;
}

interface SourceTeam {
  id: string;
  name: string;
  players?: SourcePlayer[];
}

function normalizeRole(raw: string | null | undefined): Apl2026SeedPlayer['role'] {
  if (!raw || !VALID_ROLES.has(raw)) {
    return null;
  }
  return raw as Apl2026SeedPlayer['role'];
}

function normalizeRating(value: unknown): number | null {
  if (value == null || typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }
  if (value < 0 || value > 10) {
    return null;
  }
  return value;
}

function normalizeCenter(mandal: string | null | undefined): string | null {
  if (mandal == null) {
    return null;
  }
  const trimmed = mandal.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function fetchTeam(url: string): Promise<SourceTeam> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
    const bodyPreview = (await response.text()).slice(0, 120);
    throw new Error(`Non-JSON response for ${url} (content-type: ${contentType}): ${bodyPreview}`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    throw new Error(`Invalid JSON for ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!json || typeof json !== 'object' || !('id' in json) || !('name' in json)) {
    throw new Error(`Unexpected payload shape for ${url}`);
  }

  return json as SourceTeam;
}

function mapPlayer(source: SourcePlayer): Apl2026SeedPlayer {
  const phoneRaw = normalizeSeedPhone(source.phone);
  const phoneIsSentinel = phoneRaw == null;
  const phone = phoneIsSentinel ? sentinelPhoneFromSourceId(source.id) : phoneRaw;

  return {
    sourceId: source.id,
    name: source.name.trim(),
    role: normalizeRole(source.role),
    phone,
    phoneIsSentinel,
    center: normalizeCenter(source.mandal),
    battingRating: normalizeRating(source.battingRating),
    bowlingRating: normalizeRating(source.bowlingRating),
    fieldingRating: normalizeRating(source.fieldingRating),
  };
}

function mapTeam(source: SourceTeam): Apl2026SeedTeam {
  const players = (source.players ?? []).map(mapPlayer);
  return {
    sourceId: source.id,
    name: source.name.trim(),
    players,
  };
}

async function main(): Promise<void> {
  const teams: Apl2026SeedTeam[] = [];

  for (const url of APL_2026_TEAM_EXPORT_URLS) {
    const source = await fetchTeam(url);
    teams.push(mapTeam(source));
  }

  const payload: Apl2026SeedData = {
    tournament: { name: 'APL 2026', ballType: 'TENNIS', year: 2026 },
    teams,
  };

  const outPath = path.resolve(__dirname, '../../', APL_2026_SEED_JSON_PATH);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const allPlayers = teams.flatMap((team) => team.players);
  const nullPhoneCount = allPlayers.filter((player) => player.phoneIsSentinel).length;
  const nullMandalCount = allPlayers.filter((player) => player.center == null).length;
  const centers = [...new Set(allPlayers.map((player) => player.center).filter(Boolean))].sort();

  console.log('APL 2026 Phase 1 complete.');
  console.log(`  Output: ${outPath}`);
  console.log(`  Teams: ${teams.length}`);
  console.log(`  Players: ${allPlayers.length}`);
  console.log(`  Null-phone (sentinel): ${nullPhoneCount}`);
  console.log(`  Null-mandal: ${nullMandalCount}`);
  console.log(`  Distinct centers (${centers.length}): ${centers.join(', ')}`);
  console.log('  Players per team:');
  for (const team of teams) {
    console.log(`    ${team.name}: ${team.players.length}`);
  }

  if (nullPhoneCount > 0) {
    console.log('  Sentinel-phone players:');
    for (const player of allPlayers.filter((p) => p.phoneIsSentinel)) {
      console.log(`    ${player.name} (${player.sourceId}) → ${player.phone}`);
    }
  }

  if (nullMandalCount > 0) {
    console.log('  Null-mandal players (will use fallback center in Phase 2):');
    for (const player of allPlayers.filter((p) => p.center == null)) {
      console.log(`    ${player.name} (${player.sourceId})`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
