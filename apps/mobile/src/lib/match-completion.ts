import {
  computeEconomyRate,
  computeStrikeRate,
  DismissalType,
  formatBowlerOmRw,
  formatLeaderboardEconomy,
  formatLeaderboardStrikeRate,
  InningsType,
  type BatterCard,
  type BowlerCard,
  type MatchDetail,
  type ScorecardResponse,
  type SquadPlayerView,
} from '@acc/types';

export interface ManOfMatchCandidate {
  userId: string;
  firstName: string;
  lastName: string;
  battingLine: string | null;
  bowlingLine: string | null;
}

export interface ManOfMatchStatBlock {
  label: string;
  value: string;
}

export interface ManOfMatchPlayerView {
  userId: string;
  firstName: string;
  displayName: string;
  profilePhotoUrl: string | null;
}

function aggregateBatterCards(cards: BatterCard[]): BatterCard | null {
  if (cards.length === 0) return null;
  const first = cards[0]!;
  const aggregated = cards.slice(1).reduce(
    (acc, card) => ({
      ...acc,
      runs: acc.runs + card.runs,
      balls: acc.balls + card.balls,
      ones: acc.ones + card.ones,
      twos: acc.twos + card.twos,
      threes: acc.threes + card.threes,
      fours: acc.fours + card.fours,
      sixes: acc.sixes + card.sixes,
    }),
    { ...first },
  );
  return {
    ...aggregated,
    strikeRate: computeStrikeRate(aggregated.runs, aggregated.balls) ?? 0,
  };
}

function aggregateBowlerCards(cards: BowlerCard[]): BowlerCard | null {
  if (cards.length === 0) return null;
  const legalBalls = cards.reduce((sum, card) => sum + card.legalBalls, 0);
  const oversWhole = Math.floor(legalBalls / 6);
  const oversPart = legalBalls % 6;
  const runsConceded = cards.reduce((sum, card) => sum + card.runsConceded, 0);
  return {
    playerId: cards[0]!.playerId,
    legalBalls,
    oversText: `${oversWhole}.${oversPart}`,
    runsConceded,
    wickets: cards.reduce((sum, card) => sum + card.wickets, 0),
    maidens: cards.reduce((sum, card) => sum + card.maidens, 0),
    dotBalls: cards.reduce((sum, card) => sum + card.dotBalls, 0),
    wides: cards.reduce((sum, card) => sum + card.wides, 0),
    noBalls: cards.reduce((sum, card) => sum + card.noBalls, 0),
    fours: cards.reduce((sum, card) => sum + card.fours, 0),
    sixes: cards.reduce((sum, card) => sum + card.sixes, 0),
    economy: computeEconomyRate(runsConceded, legalBalls) ?? 0,
  };
}

/** Completed match with a registered winning team — MoM may apply (§13.3). */
export function isManOfMatchApplicable(
  match: MatchDetail | null,
  card: ScorecardResponse | null,
): boolean {
  if (!match || !card) return false;
  if (match.state !== 'COMPLETED' && match.state !== 'SCORECARD_LOCKED') return false;
  if (!card.result.decided || card.result.isTie || card.result.superOverRequired) return false;
  const winnerId = card.result.winningTeamId;
  if (!winnerId) return false;
  return match.squads.some((squad) => squad.teamId === winnerId);
}

/** True when MoM has not yet been selected (pending pick). */
export function shouldOfferManOfMatch(
  match: MatchDetail | null,
  card: ScorecardResponse | null,
): boolean {
  return isManOfMatchApplicable(match, card) && !match?.manOfTheMatchUserId;
}

export function buildManOfMatchCandidates(
  match: MatchDetail,
  card: ScorecardResponse,
): ManOfMatchCandidate[] {
  const winnerId = card.result.winningTeamId;
  if (!winnerId) return [];
  const squad = match.squads.find((s) => s.teamId === winnerId);
  if (!squad) return [];

  const playing = squad.players.filter(
    (p) => p.role === 'PLAYING_XI' || p.role === 'IMPACT_CANDIDATE',
  );

  return playing
    .map((player) => toCandidate(player, card))
    .filter((candidate) => candidate.battingLine != null || candidate.bowlingLine != null);
}

/** Completed-match display card — only when MoM has been finalized (§13.3). */
export function shouldShowManOfMatchCard(
  match: MatchDetail | null,
  momUserId: string | null | undefined,
): boolean {
  if (!match || !momUserId) {
    return false;
  }
  return match.state === 'COMPLETED' || match.state === 'SCORECARD_LOCKED';
}

export function resolveManOfMatchPlayer(
  match: MatchDetail,
  userId: string,
  nameOf: (id: string) => string,
): ManOfMatchPlayerView {
  const squadPlayer = match.squads
    .flatMap((squad) => squad.players)
    .find((player) => player.userId === userId);
  if (squadPlayer) {
    return {
      userId,
      firstName: squadPlayer.firstName,
      displayName: `${squadPlayer.firstName} ${squadPlayer.lastName}`.trim(),
      profilePhotoUrl: null,
    };
  }
  const displayName = nameOf(userId);
  const [firstName = displayName] = displayName.split(' ');
  return {
    userId,
    firstName,
    displayName,
    profilePhotoUrl: null,
  };
}

function countCatches(card: ScorecardResponse, playerId: string): number {
  let catches = 0;

  for (const innings of card.innings) {
    for (const batter of innings.batters) {
      if (
        batter.isOut &&
        batter.dismissalType === DismissalType.Caught &&
        batter.fielderId === playerId
      ) {
        catches += 1;
      }
    }
  }

  return catches;
}

/** Whole-match stat mini-blocks for the finalized MoM display card (both innings). */
export function buildManOfMatchStatBlocks(
  card: ScorecardResponse,
  playerId: string,
): ManOfMatchStatBlock[] {
  const batterCards = card.innings.flatMap((innings) =>
    innings.batters.filter((batter) => batter.playerId === playerId),
  );
  const bowlerCards = card.innings.flatMap((innings) =>
    innings.bowlers.filter((bowler) => bowler.playerId === playerId),
  );
  const batting = aggregateBatterCards(batterCards);
  const bowling = aggregateBowlerCards(bowlerCards);
  const catches = countCatches(card, playerId);

  const blocks: ManOfMatchStatBlock[] = [];

  if (batting != null && batting.balls > 0) {
    blocks.push({ label: 'Batting', value: `${batting.runs} (${batting.balls})` });
  }

  if (bowling != null && bowling.legalBalls > 0) {
    blocks.push({ label: 'Bowling', value: formatBowlerOmRw(bowling) });
  }

  if (catches > 0) {
    blocks.push({ label: 'Catches', value: String(catches) });
  }

  return blocks;
}

function formatCandidateBattingLine(batting: BatterCard): string {
  const sr = formatLeaderboardStrikeRate(computeStrikeRate(batting.runs, batting.balls));
  return `${batting.runs}(${batting.balls}), ${batting.fours}×4, ${batting.sixes}×6, SR ${sr}`;
}

function formatCandidateBowlingLine(bowling: BowlerCard): string {
  const eco = formatLeaderboardEconomy(
    computeEconomyRate(bowling.runsConceded, bowling.legalBalls),
  );
  return `${formatBowlerOmRw(bowling)}, Eco ${eco}`;
}

function toCandidate(player: SquadPlayerView, card: ScorecardResponse): ManOfMatchCandidate {
  const batterCards = card.innings.flatMap((inn) =>
    inn.batters.filter((b) => b.playerId === player.userId),
  );
  const bowlerCards = card.innings.flatMap((inn) =>
    inn.bowlers.filter((b) => b.playerId === player.userId),
  );
  const batting = aggregateBatterCards(batterCards);
  const bowling = aggregateBowlerCards(bowlerCards);

  return {
    userId: player.userId,
    firstName: player.firstName,
    lastName: player.lastName,
    battingLine: batting && batting.balls >= 1 ? formatCandidateBattingLine(batting) : null,
    bowlingLine:
      bowling && bowling.legalBalls > 0 ? formatCandidateBowlingLine(bowling) : null,
  };
}

/** Innings is closed and the chase / completion step has not run yet. */
export function isInningsTransitionPending(
  match: MatchDetail | null,
  card: ScorecardResponse | null,
): boolean {
  if (!match || !card || match.state !== 'LIVE') return false;
  const live = card.innings.at(-1);
  if (!live?.closed || !live.inningsId) return false;

  const normals = card.innings.filter((i) => i.inningsType === InningsType.Normal);
  if (normals.length === 1 && live.inningsType === InningsType.Normal && live.sequence === 1) {
    return true;
  }

  if (
    normals.length >= 2 &&
    live.inningsType === InningsType.Normal &&
    live.sequence === normals[1]?.sequence
  ) {
    return true;
  }

  if (live.inningsType === InningsType.SuperOver) {
    return true;
  }

  return false;
}
