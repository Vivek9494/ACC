/**
 * Built-in overlay preview datasets. Everything here is fictional sample data —
 * preview mode never reads from the API.
 */

import type { OverlayPreviewDataset } from '@acc/types';

import type { GraphicsDataSource } from '../broadcast-fetch';
import type {
  BallType,
  BroadcastPlayerStatsView,
  InningsScorecard,
  MatchContext,
  MatchSquadPlayer,
  ScorecardResponse,
  TournamentLeaderboardView,
  TournamentStandingsView,
  TournamentStatsView,
} from '../types';
import { generateOvers, oversText, seededRandom, simulateInnings, type WicketBall } from './sample-innings';

function sampleId(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

type PlayerRole = NonNullable<MatchSquadPlayer['playerRole']>;

interface RosterSeed {
  name: string;
  role: PlayerRole;
  captain?: boolean;
  keeper?: boolean;
}

interface Roster {
  teamId: string | null;
  name: string;
  players: Array<RosterSeed & { id: string; firstName: string; lastName: string }>;
}

function roster(teamId: string | null, name: string, firstId: number, seeds: RosterSeed[]): Roster {
  return {
    teamId,
    name,
    players: seeds.map((seed, i) => {
      const [firstName = '', ...rest] = seed.name.split(' ');
      return { ...seed, id: sampleId(firstId + i), firstName, lastName: rest.join(' ') };
    }),
  };
}

function squadPlayers(team: Roster): MatchSquadPlayer[] {
  return team.players.map((p, i) => ({
    userId: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    role: 'PLAYING_XI',
    battingOrder: i + 1,
    playerRole: p.role,
    isCaptain: p.captain === true,
    isWicketKeeper: p.keeper === true,
  }));
}

function playerAt(team: Roster, index: number): string {
  return team.players[index]?.id ?? '';
}

function wicket(out: WicketBall['out'], fielder?: string, extra?: Partial<WicketBall>): WicketBall {
  return { out, ...(fielder ? { fielder } : {}), ...extra };
}

export interface PreviewDataset {
  ballType: BallType;
  card: ScorecardResponse;
  ctx: MatchContext;
  /** Innings used for batting/bowling cards, team partnerships and last wicket. */
  featuredInningsId: string;
  /** Team shown by the single-team Playing XI and batting lineup. */
  featuredTeamId: string;
  data: GraphicsDataSource;
}

interface DatasetSeed {
  ballType: BallType;
  matchId: string;
  tournamentId: string;
  home: Roster;
  away: Roster;
  awayIsExternal: boolean;
  tossWinner: MatchContext['tossWinner'];
  tossDecision: MatchContext['tossDecision'];
  first: InningsScorecard;
  second: InningsScorecard;
  featuredInningsId: string;
  standings: TournamentStandingsView;
  leaderboard: TournamentLeaderboardView;
  stats: TournamentStatsView;
  careerSeed: number;
}

function careerStats(
  player: Roster['players'][number],
  ballType: BallType,
  seed: number,
  heavy: boolean,
): BroadcastPlayerStatsView {
  const random = seededRandom(seed);
  const scale = heavy ? 6 : 1;
  const bowls = player.role !== 'BATSMAN';
  const bats = player.role !== 'BOWLER';
  const matches = Math.round((24 + random() * 40) * (heavy ? 3 : 1));
  const battingInnings = Math.max(1, matches - Math.round(random() * 6));
  const notOuts = Math.round(battingInnings * 0.12);
  const runs = Math.round((bats ? 380 + random() * 900 : 60 + random() * 160) * scale);
  const balls = Math.round(runs / (bats ? 1.32 : 0.95));
  const wickets = bowls ? Math.round((18 + random() * 40) * (heavy ? 4 : 1)) : 0;
  const bowlingLegalBalls = bowls ? Math.round(wickets * (17 + random() * 8)) : 0;
  const bowlingRunsConceded = bowls ? Math.round(bowlingLegalBalls * (1.15 + random() * 0.35)) : 0;
  const outs = Math.max(1, battingInnings - notOuts);
  const hs = bats ? Math.round(64 + random() * (heavy ? 120 : 45)) : 31;
  return {
    userId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    profilePhotoUrl: null,
    battingStyle: random() > 0.3 ? 'Right-hand bat' : 'Left-hand bat',
    bowlingStyle: bowls ? (random() > 0.5 ? 'Right-arm medium fast' : 'Slow left-arm orthodox') : null,
    ballType,
    matches,
    battingInnings,
    runs,
    average: Math.round((runs / outs) * 100) / 100,
    strikeRate: Math.round((runs / Math.max(1, balls)) * 10000) / 100,
    highestScore: `${hs}${random() > 0.5 ? '*' : ''}`,
    highestScoreOpponent: heavy ? 'Brampton Blue Mountain Cricket & Social Club' : 'Toronto Titans',
    highestScoreContext: heavy ? 'Ontario Provincial Championship Final 2025' : 'APL 2025',
    thirties: Math.round(runs / 260),
    fifties: Math.round(runs / 520),
    hundreds: hs >= 100 ? Math.max(1, Math.round(runs / 3000)) : 0,
    fours: Math.round(runs / 9),
    sixes: Math.round(runs / 26),
    notOuts,
    wickets,
    bowlingInnings: bowls ? Math.max(1, matches - 4) : 0,
    bowlingAverage: wickets > 0 ? Math.round((bowlingRunsConceded / wickets) * 100) / 100 : null,
    economy: bowlingLegalBalls > 0 ? Math.round((bowlingRunsConceded / (bowlingLegalBalls / 6)) * 100) / 100 : null,
    bowlingStrikeRate: wickets > 0 ? Math.round((bowlingLegalBalls / wickets) * 100) / 100 : null,
    bowlingRunsConceded,
    bowlingLegalBalls,
    bestBowling: bowls ? `${4 + Math.round(random() * 2)}/${12 + Math.round(random() * 20)}` : null,
    bestBowlingWickets: bowls ? 5 : null,
    bestBowlingRunsConceded: bowls ? 18 : null,
    threeWicketHauls: bowls ? Math.round(wickets / 14) : 0,
    fiveWicketHauls: bowls ? Math.round(wickets / 45) : 0,
  };
}

function buildDataset(seed: DatasetSeed): PreviewDataset {
  const { home, away } = seed;
  const players: Record<string, string> = {};
  for (const team of [home, away]) {
    for (const p of team.players) players[p.id] = `${p.firstName} ${p.lastName}`.trim();
  }
  const label = (inn: InningsScorecard) => {
    const batting = inn.battingTeamId === home.teamId ? home : away;
    const bowling = batting === home ? away : home;
    return {
      inningsId: inn.inningsId,
      battingTeamId: inn.battingTeamId,
      battingTeamName: batting.name,
      battingTeamLogoUrl: null,
      bowlingTeamId: inn.bowlingTeamId,
      bowlingTeamName: bowling.name,
    };
  };
  const target = seed.first.runs + 1;

  const card: ScorecardResponse = {
    matchId: seed.matchId,
    version: 1,
    scoringMode: 'LIVE',
    originalTarget: target,
    dlsTarget: null,
    effectiveTarget: target,
    innings: [seed.first, seed.second],
    result: { decided: false, isTie: false, isNoResult: false, note: null },
    display: { players, innings: [label(seed.first), label(seed.second)] },
  };

  const logosByTeamId: Record<string, string | null> = {};
  for (const team of [home, away]) if (team.teamId) logosByTeamId[team.teamId] = null;

  const ctx: MatchContext = {
    tournamentId: seed.tournamentId,
    homeTeamId: home.teamId,
    awayTeamId: seed.awayIsExternal ? null : away.teamId,
    homeTeamName: home.name,
    awayTeamName: seed.awayIsExternal ? null : away.name,
    externalOpponentName: seed.awayIsExternal ? away.name : null,
    tossWinner: seed.tossWinner,
    tossDecision: seed.tossDecision,
    powerplayOvers: 6,
    resultNote: null,
    overlayTheme: 'theme1',
    logosByTeamId,
    squads: [home, ...(seed.awayIsExternal ? [] : [away])].map((team) => ({
      teamId: team.teamId ?? '',
      players: squadPlayers(team),
    })),
    externalPlayers: seed.awayIsExternal
      ? away.players.map((p, i) => ({ id: p.id, slot: i + 1, name: players[p.id] ?? '' }))
      : [],
  };

  const careers = new Map<string, BroadcastPlayerStatsView>();
  const userPlayers = seed.awayIsExternal ? home.players : [...home.players, ...away.players];
  for (const [i, p] of userPlayers.entries()) {
    careers.set(p.id, careerStats(p, seed.ballType, seed.careerSeed + i, seed.awayIsExternal));
  }

  const data: GraphicsDataSource = {
    playerStats: async (userId) => careers.get(userId) ?? null,
    standings: async () => seed.standings,
    leaderboard: async () => seed.leaderboard,
    stats: async () => seed.stats,
  };

  const battingNow = seed.second.battingTeamId ?? home.teamId ?? '';
  return {
    ballType: seed.ballType,
    card,
    ctx,
    featuredInningsId: seed.featuredInningsId,
    featuredTeamId: battingNow,
    data,
  };
}

function standardDataset(): PreviewDataset {
  const tournamentId = sampleId(0x9000);
  const home = roster(sampleId(0x9101), 'Atmiya Strikers', 0x100, [
    { name: 'Aarav Patel', role: 'BATSMAN' },
    { name: 'Rohan Mehta', role: 'BATSMAN', keeper: true },
    { name: 'Vivek Bhatt', role: 'BATSMAN', captain: true },
    { name: 'Karan Shah', role: 'ALL_ROUNDER' },
    { name: 'Nikhil Desai', role: 'BATSMAN' },
    { name: 'Harsh Trivedi', role: 'ALL_ROUNDER' },
    { name: 'Jay Joshi', role: 'ALL_ROUNDER' },
    { name: 'Parth Raval', role: 'BOWLER' },
    { name: 'Dhruv Modi', role: 'BOWLER' },
    { name: 'Meet Pandya', role: 'BOWLER' },
    { name: 'Yash Thakkar', role: 'BOWLER' },
  ]);
  const away = roster(sampleId(0x9102), 'Toronto Titans', 0x200, [
    { name: 'Arjun Singh', role: 'BATSMAN' },
    { name: 'Daniel Thomas', role: 'BATSMAN', keeper: true },
    { name: 'Imran Qureshi', role: 'BATSMAN', captain: true },
    { name: 'Sameer Khan', role: 'ALL_ROUNDER' },
    { name: 'Ethan Fernandes', role: 'BATSMAN' },
    { name: 'Rahul Nair', role: 'ALL_ROUNDER' },
    { name: 'Aditya Rao', role: 'ALL_ROUNDER' },
    { name: 'Kabir Malhotra', role: 'BOWLER' },
    { name: 'Zubin Irani', role: 'BOWLER' },
    { name: 'Faizan Siddiqui', role: 'BOWLER' },
    { name: 'Omar Sheikh', role: 'BOWLER' },
  ]);
  const h = (i: number) => playerAt(home, i);
  const a = (i: number) => playerAt(away, i);

  const first = simulateInnings({
    inningsId: sampleId(0xa001),
    sequence: 1,
    battingTeamId: home.teamId,
    bowlingTeamId: away.teamId,
    battingOrder: home.players.map((p) => p.id),
    oversAllotted: 20,
    target: null,
    closed: true,
    overs: generateOvers({
      seed: 41,
      overs: 20,
      bowlers: [a(7), a(8), a(9), a(10), a(5)],
      extrasRate: 0.05,
      wickets: {
        '2.3': wicket('CAUGHT', a(1)),
        '5.6': wicket('BOWLED'),
        '9.2': wicket('LBW'),
        '12.5': wicket('RUN_OUT', a(4), { nonStriker: true, runs: 1 }),
        '15.1': wicket('CAUGHT', a(2)),
        '17.4': wicket('STUMPED', a(1)),
        '19.3': wicket('CAUGHT', a(6)),
      },
    }),
  });
  const second = simulateInnings({
    inningsId: sampleId(0xa002),
    sequence: 2,
    battingTeamId: away.teamId,
    bowlingTeamId: home.teamId,
    battingOrder: away.players.map((p) => p.id),
    oversAllotted: 20,
    target: first.runs + 1,
    closed: false,
    overs: generateOvers({
      seed: 20,
      overs: 13,
      bowlers: [h(7), h(8), h(9), h(10), h(3)],
      extrasRate: 0.05,
      wickets: {
        '3.2': wicket('CAUGHT', h(2)),
        '7.5': wicket('BOWLED'),
        '11.1': wicket('CAUGHT', h(1)),
      },
      partialOver: ['1', 'Wd', '4', '.', '1'],
    }),
  });

  const teams = [
    { id: home.teamId ?? '', name: home.name, m: 6, w: 5, l: 1, nr: 0, nrr: 1.284 },
    { id: away.teamId ?? '', name: away.name, m: 6, w: 4, l: 2, nr: 0, nrr: 0.611 },
    { id: sampleId(0x9103), name: 'Brampton Blasters', m: 6, w: 3, l: 2, nr: 1, nrr: 0.105 },
    { id: sampleId(0x9104), name: 'Scarborough Sharks', m: 6, w: 2, l: 3, nr: 1, nrr: -0.342 },
    { id: sampleId(0x9105), name: 'Mississauga Mavericks', m: 6, w: 2, l: 4, nr: 0, nrr: -0.718 },
    { id: sampleId(0x9106), name: 'Ottawa Owls', m: 6, w: 1, l: 5, nr: 0, nrr: -1.093 },
  ];
  const leaders = [
    ['Vivek', 'Bhatt', home.name],
    ['Imran', 'Qureshi', away.name],
    ['Aarav', 'Patel', home.name],
    ['Ethan', 'Fernandes', away.name],
    ['Kunal', 'Bhatia', 'Brampton Blasters'],
    ['Sahil', 'Grewal', 'Scarborough Sharks'],
    ['Neel', 'Amin', 'Ottawa Owls'],
    ['Rishi', 'Kapoor', 'Mississauga Mavericks'],
    ['Karan', 'Shah', home.name],
    ['Sameer', 'Khan', away.name],
  ] as const;

  return buildDataset({
    ballType: 'TENNIS',
    matchId: sampleId(0x8001),
    tournamentId,
    home,
    away,
    awayIsExternal: false,
    tossWinner: 'TEAM_A',
    tossDecision: 'BAT',
    first,
    second,
    featuredInningsId: second.inningsId ?? '',
    careerSeed: 300,
    standings: {
      tournamentId,
      showNetRunRate: true,
      tables: [
        {
          groupId: null,
          groupName: 'APL 2026',
          teams: teams.map((t) => ({
            teamId: t.id,
            teamName: t.name,
            logoUrl: null,
            matches: t.m,
            wins: t.w,
            losses: t.l,
            noResults: t.nr,
            points: t.w * 2 + t.nr,
            netRunRate: t.nrr,
          })),
        },
      ],
    },
    leaderboard: {
      tournamentId,
      hasRecords: true,
      batting: {
        entries: leaders.slice(0, 5).map(([firstName, lastName, teamName], i) => ({
          rank: i + 1,
          firstName,
          lastName,
          teamName,
          runs: 312 - i * 37,
        })),
      },
      bowling: {
        entries: leaders.slice(5, 10).map(([firstName, lastName, teamName], i) => ({
          rank: i + 1,
          firstName,
          lastName,
          teamName,
          wickets: 14 - i * 2,
        })),
      },
    },
    stats: {
      tournamentId,
      hasRecords: true,
      aggregates: { fours: 486, sixes: 213 },
      mostSixes: leaders.map(([firstName, lastName, teamName], i) => ({
        rank: i + 1,
        firstName,
        lastName,
        teamName,
        count: 24 - i * 2,
      })),
      mostFours: leaders.map(([firstName, lastName, teamName], i) => ({
        rank: i + 1,
        firstName,
        lastName,
        teamName,
        count: 41 - i * 3,
      })),
    },
  });
}

/** Long names, an external opponent, heavy extras and an all-out innings. */
function edgeDataset(): PreviewDataset {
  const tournamentId = sampleId(0x9200);
  const home = roster(sampleId(0x9201), 'Mississauga Maple Leaf Cricket Academy Royals', 0x300, [
    { name: 'Venkatanarasimha Raghavendra Subramanyam', role: 'BATSMAN' },
    { name: 'Christopher Fitzgerald-Montgomery', role: 'BATSMAN', keeper: true },
    { name: 'Muhammad Abdul Rehman Chaudhry', role: 'BATSMAN', captain: true },
    { name: 'Siddharthan Ramakrishnan Iyer', role: 'ALL_ROUNDER' },
    { name: 'Jean-Baptiste Okonkwo-Lefebvre', role: 'BATSMAN' },
    { name: 'Gurpreet Singh Dhaliwal-Sandhu', role: 'ALL_ROUNDER' },
    { name: 'Alexander Bartholomew Wellington', role: 'ALL_ROUNDER' },
    { name: 'Thiruvengadam Balasubramanian', role: 'BOWLER' },
    { name: 'Oluwaseun Adebayo-Williams', role: 'BOWLER' },
    { name: 'Maximilian Konstantin Von Habsburg', role: 'BOWLER' },
    { name: 'Rajagopalachari Srinivasaraghavan', role: 'BOWLER' },
  ]);
  const away = roster(null, 'Brampton Blue Mountain Cricket & Social Club', 0x400, [
    { name: 'Mohammed Hafeez Ur Rehman Siddiqui', role: 'BATSMAN' },
    { name: 'Lakshminarayanan Venkataraman', role: 'BATSMAN' },
    { name: 'Hamish McAllister-Fraser', role: 'BATSMAN' },
    { name: 'Devendra Pratap Singh Rathore', role: 'ALL_ROUNDER' },
    { name: 'Kwame Asante-Boateng', role: 'BATSMAN' },
    { name: 'Sebastian Alejandro Rodriguez', role: 'ALL_ROUNDER' },
    { name: 'Prabhakaran Chandrasekaran', role: 'ALL_ROUNDER' },
    { name: 'Tadashi Nakamura-Henderson', role: 'BOWLER' },
    { name: 'Benedict Cumberbatch-Okafor', role: 'BOWLER' },
    { name: 'Ramachandran Gopalakrishnan', role: 'BOWLER' },
    { name: 'Xavier Leclerc-Beaumont', role: 'BOWLER' },
  ]);
  const h = (i: number) => playerAt(home, i);

  const first = simulateInnings({
    inningsId: sampleId(0xb001),
    sequence: 1,
    battingTeamId: null,
    bowlingTeamId: home.teamId,
    battingIsExternal: true,
    battingOrder: away.players.map((p) => p.id),
    oversAllotted: 25,
    target: null,
    closed: true,
    overs: generateOvers({
      seed: 1234,
      overs: 25,
      bowlers: [h(7), h(8), h(9), h(10), h(5)],
      extrasRate: 0.2,
      wickets: {
        '1.4': wicket('BOWLED'),
        '3.1': wicket('CAUGHT', h(1)),
        '4.6': wicket('LBW'),
        '7.2': wicket('CAUGHT', h(3)),
        '9.5': wicket('RUN_OUT', h(6), { runs: 2 }),
        '11.3': wicket('STUMPED', h(1)),
        '13.6': wicket('CAUGHT', h(4)),
        '15.2': wicket('HIT_WICKET'),
        '17.1': wicket('BOWLED'),
        '18.4': wicket('CAUGHT', h(2)),
      },
    }),
  });
  const second = simulateInnings({
    inningsId: sampleId(0xb002),
    sequence: 2,
    battingTeamId: home.teamId,
    bowlingTeamId: null,
    bowlingIsExternal: true,
    battingOrder: home.players.map((p) => p.id),
    oversAllotted: 25,
    target: first.runs + 1,
    closed: false,
    overs: generateOvers({
      seed: 99,
      overs: 6,
      bowlers: away.players.slice(7).map((p) => p.id),
      extrasRate: 0.15,
      wickets: { '2.5': wicket('CAUGHT', away.players[1]?.id) },
      partialOver: ['Wd+1', 'Nb', '2', 'Lb1', '.', '3'],
    }),
  });

  const longTeams = [
    'Mississauga Maple Leaf Cricket Academy Royals',
    'Brampton Blue Mountain Cricket & Social Club',
    'Scarborough Bluffs United Cricket Association',
    'Richmond Hill Lions Sports & Cultural Club',
    'Kitchener-Waterloo Golden Hawks CC',
    'Oakville Lakeshore Thunderbolts',
    'Hamilton Steel City Strikers',
    'London Forest City Falcons XI',
  ];
  const groupRows = (names: string[], startId: number) =>
    names.map((name, i) => ({
      teamId: sampleId(startId + i),
      teamName: name,
      logoUrl: null,
      matches: 7,
      wins: 6 - i,
      losses: i,
      noResults: i === 2 ? 1 : 0,
      points: (6 - i) * 2 + (i === 2 ? 1 : 0),
      netRunRate: Math.round((2.315 - i * 1.287) * 1000) / 1000,
    }));
  const leaderNames = home.players.slice(0, 10);

  return buildDataset({
    ballType: 'LEATHER',
    matchId: sampleId(0x8002),
    tournamentId,
    home,
    away,
    awayIsExternal: true,
    tossWinner: 'TEAM_B',
    tossDecision: 'BAT',
    first,
    second,
    featuredInningsId: first.inningsId ?? '',
    careerSeed: 900,
    standings: {
      tournamentId,
      showNetRunRate: true,
      tables: [
        { groupId: sampleId(0x9301), groupName: 'Group A — Eastern Conference', teams: groupRows(longTeams.slice(0, 4), 0x9311) },
        { groupId: sampleId(0x9302), groupName: 'Group B — Western Conference', teams: groupRows(longTeams.slice(4), 0x9321) },
      ],
    },
    leaderboard: {
      tournamentId,
      hasRecords: true,
      batting: {
        entries: leaderNames.slice(0, 5).map((p, i) => ({
          rank: i + 1,
          firstName: p.firstName,
          lastName: p.lastName,
          teamName: longTeams[i % longTeams.length] ?? '',
          runs: 1287 - i * 141,
        })),
      },
      bowling: {
        entries: leaderNames.slice(5, 10).map((p, i) => ({
          rank: i + 1,
          firstName: p.firstName,
          lastName: p.lastName,
          teamName: longTeams[(i + 3) % longTeams.length] ?? '',
          wickets: 38 - i * 4,
        })),
      },
    },
    stats: {
      tournamentId,
      hasRecords: true,
      aggregates: { fours: 12_487, sixes: 4_903 },
      mostSixes: leaderNames.map((p, i) => ({
        rank: i + 1,
        firstName: p.firstName,
        lastName: p.lastName,
        teamName: longTeams[i % longTeams.length] ?? '',
        count: 112 - i * 9,
      })),
      mostFours: leaderNames.map((p, i) => ({
        rank: i + 1,
        firstName: p.firstName,
        lastName: p.lastName,
        teamName: longTeams[(i + 1) % longTeams.length] ?? '',
        count: 268 - i * 17,
      })),
    },
  });
}

export function loadPreviewDataset(key: OverlayPreviewDataset): PreviewDataset {
  return key === 'edge' ? edgeDataset() : standardDataset();
}

/** Same card with one extra boundary ball at the end of the live innings. */
export function withBoundaryBall(card: ScorecardResponse, runs: 4 | 6): ScorecardResponse {
  const live = card.innings.find((inn) => !inn.closed);
  if (!live || !live.currentStrikerId) {
    return card;
  }
  const strikerId = live.currentStrikerId;
  const last = live.timeline?.at(-1);
  const legalBalls = live.legalBalls + 1;
  const updated: InningsScorecard = {
    ...live,
    runs: live.runs + runs,
    legalBalls,
    oversText: oversText(legalBalls),
    batters: live.batters.map((b) =>
      b.playerId === strikerId
        ? {
            ...b,
            runs: b.runs + runs,
            balls: b.balls + 1,
            fours: b.fours + (runs === 4 ? 1 : 0),
            sixes: b.sixes + (runs === 6 ? 1 : 0),
            strikeRate: Math.round(((b.runs + runs) / (b.balls + 1)) * 10000) / 100,
          }
        : b,
    ),
    bowlers: live.bowlers.map((b) => {
      if (b.playerId !== live.currentBowlerId) return b;
      const balls = b.legalBalls + 1;
      const conceded = b.runsConceded + runs;
      return {
        ...b,
        legalBalls: balls,
        oversText: oversText(balls),
        runsConceded: conceded,
        fours: (b.fours ?? 0) + (runs === 4 ? 1 : 0),
        sixes: (b.sixes ?? 0) + (runs === 6 ? 1 : 0),
        economy: Math.round((conceded / (balls / 6)) * 100) / 100,
      };
    }),
    recentOvers: (live.recentOvers ?? []).map((over, i, all) =>
      i === all.length - 1
        ? { ...over, balls: [...over.balls, String(runs)], runs: over.runs + runs }
        : over,
    ),
    timeline: [
      ...(live.timeline ?? []),
      {
        sequence: (last?.sequence ?? 0) + 1,
        overNumber: last?.overNumber ?? 1,
        ballNumber: (last?.ballNumber ?? 0) + 1,
        label: `${last?.overNumber ?? 1}.${(last?.ballNumber ?? 0) + 1}`,
        code: String(runs),
        runs,
        isWicket: false,
        isBoundary: true,
        description: runs === 6 ? 'SIX' : 'FOUR',
        strikerId,
        bowlerId: live.currentBowlerId,
      },
    ],
  };
  return {
    ...card,
    version: card.version + 1,
    innings: card.innings.map((inn) => (inn === live ? updated : inn)),
  };
}
