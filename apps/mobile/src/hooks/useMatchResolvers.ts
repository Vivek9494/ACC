import type { InningsScorecard, MatchDetail, ScorecardResponse } from '@acc/types';
import { useMemo } from 'react';

import type { NameResolver } from '../components/LiveScorecard';

export interface BattingTeamLabel {
  name: string;
  logoUrl: string | null;
}

/** Tab label for multi-innings scorecard views — e.g. "Barrie Cobras innings". */
export function inningsTabLabel(
  innings: InningsScorecard,
  battingTeamLabel: (innings: InningsScorecard) => BattingTeamLabel,
): string {
  const base = `${battingTeamLabel(innings).name} innings`;
  return innings.inningsType === 'SUPER_OVER' ? `${base} (SO)` : base;
}

function mergeMatchPlayers(
  players: Map<string, string>,
  match: MatchDetail,
): void {
  for (const squad of match.squads) {
    for (const p of squad.players) {
      if (!players.has(p.userId)) {
        players.set(p.userId, `${p.firstName} ${p.lastName}`);
      }
    }
  }
  for (const ext of match.externalPlayers) {
    if (!players.has(ext.id)) {
      players.set(ext.id, ext.name);
    }
  }
}

function mergeMatchTeams(
  teams: Map<string, string>,
  teamLogos: Map<string, string | null>,
  match: MatchDetail,
): void {
  for (const squad of match.squads) {
    if (!teams.has(squad.teamId)) {
      teams.set(squad.teamId, squad.teamName);
    }
  }
  if (match.homeTeamId && match.homeTeamName && !teams.has(match.homeTeamId)) {
    teams.set(match.homeTeamId, match.homeTeamName);
  }
  if (match.awayTeamId && match.awayTeamName && !teams.has(match.awayTeamId)) {
    teams.set(match.awayTeamId, match.awayTeamName);
  }
}

function inningsLabelFor(
  card: ScorecardResponse | null,
  innings: InningsScorecard,
): BattingTeamLabel | null {
  const label = card?.display.innings.find((row) => row.inningsId === innings.inningsId);
  if (!label) {
    return null;
  }
  return { name: label.battingTeamName, logoUrl: label.battingTeamLogoUrl };
}

/**
 * Builds id→name resolvers from the scorecard display payload (public, always
 * available) with optional {@link MatchDetail} as a fallback for older caches.
 */
export function useScorecardResolvers(
  card: ScorecardResponse | null,
  match: MatchDetail | null,
): {
  nameOf: NameResolver;
  teamNameOf: NameResolver;
  battingTeamLabel: (innings: InningsScorecard) => BattingTeamLabel;
} {
  return useMemo(() => {
    const players = new Map<string, string>();
    const teams = new Map<string, string>();
    const teamLogos = new Map<string, string | null>();
    const inningsLabels = new Map<string | null, BattingTeamLabel>();

    if (card?.display) {
      for (const [id, name] of Object.entries(card.display.players)) {
        players.set(id, name);
      }
      for (const inn of card.display.innings) {
        inningsLabels.set(inn.inningsId, {
          name: inn.battingTeamName,
          logoUrl: inn.battingTeamLogoUrl,
        });
        if (inn.battingTeamId) {
          teams.set(inn.battingTeamId, inn.battingTeamName);
          teamLogos.set(inn.battingTeamId, inn.battingTeamLogoUrl);
        }
        if (inn.bowlingTeamId) {
          teams.set(inn.bowlingTeamId, inn.bowlingTeamName);
        }
      }
    }

    if (match) {
      mergeMatchPlayers(players, match);
      mergeMatchTeams(teams, teamLogos, match);
    }

    const nameOf: NameResolver = (id) => (id ? (players.get(id) ?? 'Player') : '—');
    const teamNameOf: NameResolver = (id) =>
      id ? (teams.get(id) ?? match?.externalOpponentName ?? 'Team') : 'Team';

    const battingTeamLabel = (innings: InningsScorecard): BattingTeamLabel => {
      const fromCard = inningsLabelFor(card, innings);
      if (fromCard) {
        return fromCard;
      }
      const cached = innings.inningsId != null ? inningsLabels.get(innings.inningsId) : undefined;
      if (cached) {
        return cached;
      }
      return {
        name: innings.battingTeamId
          ? teamNameOf(innings.battingTeamId)
          : (match?.externalOpponentName ?? 'Team'),
        logoUrl: innings.battingTeamId ? (teamLogos.get(innings.battingTeamId) ?? null) : null,
      };
    };

    return { nameOf, teamNameOf, battingTeamLabel };
  }, [card, match]);
}

/** @deprecated Prefer {@link useScorecardResolvers} — match-only resolution misses guest scorecard views. */
export function useMatchResolvers(match: MatchDetail | null): {
  nameOf: NameResolver;
  teamNameOf: NameResolver;
} {
  return useMemo(() => {
    const players = new Map<string, string>();
    const teams = new Map<string, string>();
    if (match) {
      for (const squad of match.squads) {
        teams.set(squad.teamId, squad.teamName);
        for (const p of squad.players) {
          players.set(p.userId, `${p.firstName} ${p.lastName}`);
        }
      }
      if (match.homeTeamId) teams.set(match.homeTeamId, match.homeTeamName ?? 'Home');
      if (match.awayTeamId) teams.set(match.awayTeamId, match.awayTeamName ?? 'Away');
      for (const ext of match.externalPlayers) {
        players.set(ext.id, ext.name);
      }
    }
    const nameOf: NameResolver = (id) => (id ? (players.get(id) ?? 'Player') : '—');
    const teamNameOf: NameResolver = (id) =>
      id ? (teams.get(id) ?? match?.externalOpponentName ?? 'Team') : 'Team';
    return { nameOf, teamNameOf };
  }, [match]);
}
