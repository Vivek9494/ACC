import type { QualifiedTeam } from './knockout-qualification';
import { computeKnockoutSeeding } from './knockout-seeding.compute';

export const KNOCKOUT_MANUAL_SEED_ERROR = 'KNOCKOUT_MANUAL_SEED_INVALID' as const;

export interface GenerateKnockoutBracketRequest {
  /** Explicit seed order (index 0 = seed 1). Omit for automatic qualification order. */
  teamIds?: string[];
}

export interface KnockoutSeedingPreviewHint {
  byeSummary: string;
  playInMatchCount: number;
  /** Non-blocking — same-group teams meeting in round 1 under the current order. */
  sameGroupRound1Warnings: string[];
}

export class KnockoutManualSeedOrderError extends Error {
  readonly code = KNOCKOUT_MANUAL_SEED_ERROR;

  constructor(message: string) {
    super(message);
    this.name = 'KnockoutManualSeedOrderError';
  }
}

/** Validates that manual seed order matches the qualified set exactly. */
export function validateManualSeedOrder(
  qualifiedTeams: readonly QualifiedTeam[],
  teamIds: readonly string[],
): void {
  if (teamIds.length !== qualifiedTeams.length) {
    throw new KnockoutManualSeedOrderError(
      'The seed order must include exactly the qualified teams',
    );
  }

  const qualifiedSet = new Set(qualifiedTeams.map((team) => team.teamId));
  const seen = new Set<string>();

  for (const teamId of teamIds) {
    if (!qualifiedSet.has(teamId)) {
      throw new KnockoutManualSeedOrderError(
        'The seed order must include only qualified teams',
      );
    }
    if (seen.has(teamId)) {
      throw new KnockoutManualSeedOrderError(
        'The seed order must not contain duplicate teams',
      );
    }
    seen.add(teamId);
  }
}

/** Reorders qualified teams to match an explicit seed order (1..N). */
export function reorderQualifiedTeamsBySeedOrder(
  qualifiedTeams: readonly QualifiedTeam[],
  teamIds: readonly string[],
): QualifiedTeam[] {
  validateManualSeedOrder(qualifiedTeams, teamIds);
  const byId = new Map(qualifiedTeams.map((team) => [team.teamId, team]));
  return teamIds.map((teamId) => {
    const team = byId.get(teamId);
    if (!team) {
      throw new KnockoutManualSeedOrderError(
        'The seed order must include only qualified teams',
      );
    }
    return team;
  });
}

function teamNameById(teams: readonly QualifiedTeam[], teamId: string): string {
  return teams.find((team) => team.teamId === teamId)?.teamName ?? 'Team';
}

function groupIdById(teams: readonly QualifiedTeam[], teamId: string): string | null {
  return teams.find((team) => team.teamId === teamId)?.groupId ?? null;
}

/** Live preview of bye / play-in implications for a seed order. */
export function buildKnockoutSeedingPreviewHint(
  orderedTeams: readonly QualifiedTeam[],
): KnockoutSeedingPreviewHint {
  const seeding = computeKnockoutSeeding({ qualifiedTeams: orderedTeams });

  let byeSummary: string;
  if (seeding.byeCount === 0) {
    byeSummary = 'No byes — every team plays in the first round.';
  } else if (seeding.byeCount === 1) {
    byeSummary = 'Seed 1 receives a bye.';
  } else {
    byeSummary = `Seeds 1–${seeding.byeCount} receive byes.`;
  }

  const sameGroupRound1Warnings: string[] = [];
  for (const playIn of seeding.round1Matches) {
    const higherGroupId = groupIdById(orderedTeams, playIn.higherSeedTeamId);
    const lowerGroupId = groupIdById(orderedTeams, playIn.lowerSeedTeamId);
    if (higherGroupId != null && higherGroupId === lowerGroupId) {
      const higherName = teamNameById(orderedTeams, playIn.higherSeedTeamId);
      const lowerName = teamNameById(orderedTeams, playIn.lowerSeedTeamId);
      sameGroupRound1Warnings.push(
        `${higherName} and ${lowerName} would meet in the first round (same group).`,
      );
    }
  }

  return {
    byeSummary,
    playInMatchCount: seeding.round1Matches.length,
    sameGroupRound1Warnings,
  };
}
