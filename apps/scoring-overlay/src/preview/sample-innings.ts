/**
 * Deterministic innings simulator for overlay preview sample data. Produces a
 * self-consistent InningsScorecard (batters, bowlers, extras, FOW, partnerships,
 * timeline, recent overs) using the API's delivery codes (fold.ts deliveryCode).
 */

import type {
  BatterCard,
  BowlerCard,
  CompletedPartnership,
  DismissalType,
  ExtrasBreakdown,
  FallOfWicket,
  InningsScorecard,
  OverSummary,
  TimelineEntry,
} from '../types';

const BALLS_PER_OVER = 6;
const WICKETS_ALL_OUT = 10;
const RECENT_OVERS = 6;

export interface WicketBall {
  out: DismissalType;
  fielder?: string;
  runs?: number;
  /** Run-out victim; defaults to the striker. */
  nonStriker?: boolean;
}

/** `.` `1`–`6` `Wd` `Wd+n` `Nb` `Nb+n` `Bn` `Lbn`, or a wicket. */
export type ScriptBall = string | WicketBall;

export interface ScriptOver {
  bowler: string;
  balls: ScriptBall[];
}

export interface InningsScript {
  inningsId: string;
  sequence: number;
  battingTeamId: string | null;
  bowlingTeamId: string | null;
  battingIsExternal?: boolean;
  bowlingIsExternal?: boolean;
  battingOrder: string[];
  overs: ScriptOver[];
  oversAllotted: number;
  target: number | null;
  closed: boolean;
}

interface Delivery {
  kind: 'legal' | 'wide' | 'no_ball' | 'bye' | 'leg_bye';
  bat: number;
  extra: number;
  boundary: boolean;
  wicket: WicketBall | null;
}

function parseBall(ball: ScriptBall): Delivery {
  if (typeof ball !== 'string') {
    return { kind: 'legal', bat: ball.runs ?? 0, extra: 0, boundary: false, wicket: ball };
  }
  const wide = /^Wd(?:\+(\d))?$/.exec(ball);
  if (wide) {
    return { kind: 'wide', bat: 0, extra: 1 + Number(wide[1] ?? 0), boundary: false, wicket: null };
  }
  const noBall = /^Nb(?:\+(\d))?$/.exec(ball);
  if (noBall) {
    const bat = Number(noBall[1] ?? 0);
    return { kind: 'no_ball', bat, extra: 1, boundary: bat === 4 || bat === 6, wicket: null };
  }
  const bye = /^B(\d)$/.exec(ball);
  if (bye) {
    return { kind: 'bye', bat: 0, extra: Number(bye[1]), boundary: false, wicket: null };
  }
  const legBye = /^Lb(\d)$/.exec(ball);
  if (legBye) {
    return { kind: 'leg_bye', bat: 0, extra: Number(legBye[1]), boundary: false, wicket: null };
  }
  const bat = ball === '.' ? 0 : Number(ball);
  if (!Number.isInteger(bat) || bat < 0 || bat > 6) {
    throw new Error(`Unknown sample ball "${ball}"`);
  }
  return { kind: 'legal', bat, extra: 0, boundary: bat === 4 || bat === 6, wicket: null };
}

function deliveryCode(d: Delivery): string {
  if (d.wicket) return d.bat > 0 ? `${d.bat}+W` : 'W';
  switch (d.kind) {
    case 'wide':
      return d.extra > 1 ? `Wd+${d.extra - 1}` : 'Wd';
    case 'no_ball':
      return d.bat > 0 ? `Nb+${d.bat}` : 'Nb';
    case 'bye':
      return `B${d.extra}`;
    case 'leg_bye':
      return `Lb${d.extra}`;
    default:
      return d.bat === 0 ? '·' : String(d.bat);
  }
}

const DISMISSAL_LABELS: Record<DismissalType, string> = {
  BOWLED: 'Bowled',
  CAUGHT: 'Caught',
  LBW: 'LBW',
  RUN_OUT: 'Run Out',
  STUMPED: 'Stumped',
  HIT_WICKET: 'Hit Wicket',
  RETIRED_OUT: 'Retired Out',
  OBSTRUCTING_THE_FIELD: 'Obstructing the Field',
  HIT_THE_BALL_TWICE: 'Hit the Ball Twice',
  TIMED_OUT: 'Timed Out',
};

function deliveryDescription(d: Delivery): string {
  if (d.wicket) return `WICKET — ${DISMISSAL_LABELS[d.wicket.out]}`;
  if (d.boundary && d.bat === 6) return 'SIX';
  if (d.boundary && d.bat === 4) return 'FOUR';
  if (d.kind === 'wide') return `Wide +${d.extra}`;
  if (d.kind === 'no_ball') return `No Ball +${d.extra + d.bat}`;
  if (d.kind === 'bye') return `Bye +${d.extra}`;
  if (d.kind === 'leg_bye') return `Leg Bye +${d.extra}`;
  return `${d.bat} run${d.bat === 1 ? '' : 's'}`;
}

export function oversText(legalBalls: number): string {
  return `${Math.floor(legalBalls / BALLS_PER_OVER)}.${legalBalls % BALLS_PER_OVER}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

interface Stand {
  batterIds: [string, string];
  runs: number;
  balls: number;
  batterRuns: Map<string, number>;
}

function newStand(a: string, b: string): Stand {
  return { batterIds: [a, b], runs: 0, balls: 0, batterRuns: new Map([[a, 0], [b, 0]]) };
}

function standView(stand: Stand): CompletedPartnership {
  return {
    batterIds: [...stand.batterIds],
    batterRuns: stand.batterIds.map((playerId) => ({
      playerId,
      runs: stand.batterRuns.get(playerId) ?? 0,
    })),
    runs: stand.runs,
    balls: stand.balls,
  };
}

export function simulateInnings(script: InningsScript): InningsScorecard {
  const batters = new Map<string, BatterCard>();
  const bowlers = new Map<string, BowlerCard>();
  const extras: ExtrasBreakdown = { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 };
  const fallOfWickets: FallOfWicket[] = [];
  const partnerships: CompletedPartnership[] = [];
  const timeline: TimelineEntry[] = [];

  const batter = (playerId: string): BatterCard => {
    let card = batters.get(playerId);
    if (!card) {
      card = {
        playerId,
        runs: 0,
        balls: 0,
        ones: 0,
        twos: 0,
        threes: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        isOut: false,
        dismissalType: null,
        bowlerId: null,
        fielderId: null,
        fielder2Id: null,
        retiredHurt: false,
        isMankad: false,
      };
      batters.set(playerId, card);
    }
    return card;
  };

  const bowler = (playerId: string): BowlerCard => {
    let card = bowlers.get(playerId);
    if (!card) {
      card = {
        playerId,
        legalBalls: 0,
        oversText: '0.0',
        runsConceded: 0,
        wickets: 0,
        maidens: 0,
        dotBalls: 0,
        wides: 0,
        noBalls: 0,
        fours: 0,
        sixes: 0,
        economy: 0,
      };
      bowlers.set(playerId, card);
    }
    return card;
  };

  const order = script.battingOrder;
  let striker = order[0] ?? '';
  let nonStriker = order[1] ?? '';
  let nextIn = 2;
  batter(striker);
  batter(nonStriker);
  let stand = newStand(striker, nonStriker);
  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;
  let sequence = 0;

  for (const [index, over] of script.overs.entries()) {
    const overNumber = index + 1;
    const bowl = bowler(over.bowler);
    let legalInOver = 0;
    let concededInOver = 0;

    for (const ball of over.balls) {
      if (wickets >= WICKETS_ALL_OUT) break;
      const d = parseBall(ball);
      const legal = d.kind === 'legal' || d.kind === 'bye' || d.kind === 'leg_bye';
      const faced = legal || d.kind === 'no_ball';
      const total = d.bat + d.extra;
      const conceded = d.bat + (d.kind === 'wide' || d.kind === 'no_ball' ? d.extra : 0);
      const onStrike = batter(striker);
      sequence += 1;

      if (legal) {
        legalBalls += 1;
        legalInOver += 1;
        bowl.legalBalls += 1;
        if (conceded === 0) bowl.dotBalls += 1;
      }
      if (faced) onStrike.balls += 1;
      onStrike.runs += d.bat;
      if (d.bat === 1) onStrike.ones = (onStrike.ones ?? 0) + 1;
      if (d.bat === 2) onStrike.twos = (onStrike.twos ?? 0) + 1;
      if (d.bat === 3) onStrike.threes = (onStrike.threes ?? 0) + 1;
      if (d.boundary && d.bat === 4) {
        onStrike.fours += 1;
        bowl.fours = (bowl.fours ?? 0) + 1;
      }
      if (d.boundary && d.bat === 6) {
        onStrike.sixes += 1;
        bowl.sixes = (bowl.sixes ?? 0) + 1;
      }
      if (d.kind === 'wide') {
        extras.wides += d.extra;
        bowl.wides = (bowl.wides ?? 0) + 1;
      } else if (d.kind === 'no_ball') {
        extras.noBalls += d.extra;
        bowl.noBalls = (bowl.noBalls ?? 0) + 1;
      } else if (d.kind === 'bye') {
        extras.byes += d.extra;
      } else if (d.kind === 'leg_bye') {
        extras.legByes += d.extra;
      }
      bowl.runsConceded += conceded;
      concededInOver += conceded;
      runs += total;
      stand.runs += total;
      if (legal) stand.balls += 1;
      stand.batterRuns.set(striker, (stand.batterRuns.get(striker) ?? 0) + d.bat);

      timeline.push({
        sequence,
        overNumber,
        ballNumber: legal ? legalInOver : legalInOver + 1,
        label: `${overNumber}.${legal ? legalInOver : legalInOver + 1}`,
        code: deliveryCode(d),
        runs: total,
        isWicket: d.wicket != null,
        isBoundary: d.boundary,
        description: deliveryDescription(d),
        strikerId: striker,
        bowlerId: over.bowler,
      });

      const crossed = d.kind === 'wide' ? d.extra - 1 : d.kind === 'bye' || d.kind === 'leg_bye' ? d.extra : d.bat;
      if (crossed % 2 === 1) {
        [striker, nonStriker] = [nonStriker, striker];
      }

      if (d.wicket) {
        const outId = d.wicket.nonStriker ? nonStriker : striker;
        const out = batter(outId);
        out.isOut = true;
        out.dismissalType = d.wicket.out;
        out.fielderId = d.wicket.fielder ?? null;
        if (d.wicket.out !== 'RUN_OUT') {
          out.bowlerId = over.bowler;
          bowl.wickets += 1;
        }
        wickets += 1;
        fallOfWickets.push({
          wicketNumber: wickets,
          playerId: outId,
          teamRuns: runs,
          oversText: oversText(legalBalls),
        });
        partnerships.push(standView(stand));
        const incoming = wickets < WICKETS_ALL_OUT ? order[nextIn] : undefined;
        nextIn += 1;
        if (incoming) {
          batter(incoming);
          if (outId === striker) striker = incoming;
          else nonStriker = incoming;
          stand = newStand(striker, nonStriker);
        }
      }
    }

    if (legalInOver === BALLS_PER_OVER) {
      if (concededInOver === 0) bowl.maidens += 1;
      [striker, nonStriker] = [nonStriker, striker];
    }
  }

  extras.total = extras.wides + extras.noBalls + extras.byes + extras.legByes + extras.penalties;
  const allOut = wickets >= WICKETS_ALL_OUT;
  const closed = script.closed || allOut;

  for (const card of batters.values()) {
    card.strikeRate = card.balls > 0 ? round2((card.runs / card.balls) * 100) : 0;
  }
  for (const card of bowlers.values()) {
    card.oversText = oversText(card.legalBalls);
    card.economy = card.legalBalls > 0 ? round2(card.runsConceded / (card.legalBalls / BALLS_PER_OVER)) : 0;
  }

  const overMap = new Map<number, OverSummary>();
  for (const entry of timeline) {
    if (entry.overNumber == null) continue;
    const over = overMap.get(entry.overNumber) ?? {
      overNumber: entry.overNumber,
      balls: [],
      runs: 0,
      wickets: 0,
    };
    over.balls.push(entry.code);
    over.runs += entry.runs;
    if (entry.isWicket) over.wickets += 1;
    overMap.set(entry.overNumber, over);
  }

  return {
    inningsId: script.inningsId,
    sequence: script.sequence,
    inningsType: 'REGULAR',
    battingTeamId: script.battingTeamId,
    bowlingTeamId: script.bowlingTeamId,
    battingIsExternal: script.battingIsExternal ?? false,
    bowlingIsExternal: script.bowlingIsExternal ?? false,
    runs,
    wickets,
    legalBalls,
    oversText: oversText(legalBalls),
    oversAllotted: script.oversAllotted,
    extras,
    batters: [...batters.values()],
    bowlers: [...bowlers.values()],
    fallOfWickets,
    partnership: allOut ? null : { ...standView(stand) },
    partnerships,
    recentOvers: [...overMap.values()].slice(-RECENT_OVERS),
    timeline,
    currentStrikerId: closed ? null : striker,
    currentNonStrikerId: closed ? null : nonStriker,
    currentBowlerId: closed ? null : (script.overs.at(-1)?.bowler ?? null),
    closed,
    target: script.target,
  };
}

/** Mulberry32 — stable pseudo-random sequence so samples never change between loads. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OverGeneratorOptions {
  seed: number;
  /** Bowling rotation, cycled one over each (consecutive overs never repeat). */
  bowlers: string[];
  overs: number;
  /** Wickets keyed by `over.legalBall` (1-based), e.g. `"3.4"`. */
  wickets: Record<string, WicketBall>;
  /** Scripted deliveries for a trailing partial over. */
  partialOver?: ScriptBall[];
  /** Probability that a delivery is an extra (wide / no-ball / bye / leg-bye). */
  extrasRate: number;
}

const LEGAL_WEIGHTS: Array<[string, number]> = [
  ['.', 33],
  ['1', 34],
  ['2', 11],
  ['3', 2],
  ['4', 13],
  ['6', 7],
];
const EXTRA_WEIGHTS: Array<[string, number]> = [
  ['Wd', 45],
  ['Wd+1', 8],
  ['Nb', 12],
  ['Nb+4', 5],
  ['Lb1', 15],
  ['B1', 8],
  ['B4', 7],
];

function pick(random: () => number, weights: Array<[string, number]>): string {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = random() * total;
  for (const [value, weight] of weights) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return weights[0]?.[0] ?? '.';
}

export function generateOvers(options: OverGeneratorOptions): ScriptOver[] {
  const random = seededRandom(options.seed);
  const overs: ScriptOver[] = [];
  for (let o = 0; o < options.overs; o += 1) {
    const balls: ScriptBall[] = [];
    let legal = 0;
    while (legal < BALLS_PER_OVER) {
      const wicket = options.wickets[`${o + 1}.${legal + 1}`];
      if (wicket) {
        balls.push(wicket);
        legal += 1;
        continue;
      }
      if (random() < options.extrasRate) {
        const extra = pick(random, EXTRA_WEIGHTS);
        balls.push(extra);
        if (extra.startsWith('B') || extra.startsWith('Lb')) legal += 1;
        continue;
      }
      balls.push(pick(random, LEGAL_WEIGHTS));
      legal += 1;
    }
    overs.push({ bowler: options.bowlers[o % options.bowlers.length] ?? '', balls });
  }
  if (options.partialOver && options.partialOver.length > 0) {
    overs.push({
      bowler: options.bowlers[options.overs % options.bowlers.length] ?? '',
      balls: options.partialOver,
    });
  }
  return overs;
}
