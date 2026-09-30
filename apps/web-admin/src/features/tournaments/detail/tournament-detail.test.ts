import {
  BallType,
  type BattingLeaderboardEntry,
  type BowlingLeaderboardEntry,
  MatchSchedulingFormat,
  type MatchListItem,
  type ScorecardResponse,
  type TournamentBoundaryLeaderboardEntry,
  TournamentType,
} from '@acc/types';
import { describe, expect, it } from 'vitest';

import {
  allTeamsAssigned,
  buildLeaderCards,
  DETAIL_TABS,
  formatFallOfWicketsLine,
  formatMatchWhen,
  groupMemberDiff,
  inningsTeams,
  scorecardNameResolver,
  splitScoreLine,
  unassignedTeams,
  visibleDetailTabs,
  visibleMatches,
} from './tournament-detail';

const person = (userId: string) => ({
  userId,
  firstName: userId,
  lastName: 'X',
  profilePhotoUrl: null,
  teamId: 't1',
  teamName: 'Hornets',
  teamLogoUrl: null,
});

const batter = (userId: string, runs: number, balls: number): BattingLeaderboardEntry => ({
  ...person(userId),
  rank: 0,
  matches: 1,
  runs,
  balls,
  thirties: 0,
  fifties: 0,
  average: null,
  strikeRate: balls > 0 ? (runs / balls) * 100 : null,
});

const bowler = (userId: string, wickets: number, economy: number, legalBalls: number): BowlingLeaderboardEntry => ({
  ...person(userId),
  rank: 0,
  matches: 1,
  innings: 1,
  wickets,
  legalBalls,
  bestBowling: null,
  economy,
});

const boundary = (userId: string, count: number): TournamentBoundaryLeaderboardEntry => ({
  ...person(userId),
  rank: 1,
  count,
});

describe('tournament detail', () => {
  it('has the detail tabs in order', () => {
    expect(DETAIL_TABS.map((tab) => tab.label)).toEqual([
      'Teams',
      'Groups',
      'Matches',
      'Points table',
      'Tournament stats',
      'Registrations',
      'Details',
    ]);
  });

  describe('Groups tab visibility', () => {
    const tennis = {
      type: TournamentType.Center,
      ballType: BallType.Tennis,
      matchSchedulingFormat: null,
      groupCount: 0,
    };
    const hasGroupsTab = (tournament: Parameters<typeof visibleDetailTabs>[0]) =>
      visibleDetailTabs(tournament).some((tab) => tab.path === 'groups');

    it('shows Groups right after Teams for Group Stage + Knockout', () => {
      const tabs = visibleDetailTabs({
        ...tennis,
        matchSchedulingFormat: MatchSchedulingFormat.GroupStageKnockout,
        groupCount: 2,
      });
      expect(tabs.map((tab) => tab.path).slice(0, 3)).toEqual(['teams', 'groups', 'matches']);
    });

    it('shows Groups for tennis with no format yet', () => {
      expect(hasGroupsTab(tennis)).toBe(true);
    });

    it('hides Groups for other finalized formats and for Leather', () => {
      expect(hasGroupsTab({ ...tennis, matchSchedulingFormat: MatchSchedulingFormat.RoundRobin })).toBe(false);
      expect(hasGroupsTab({ ...tennis, matchSchedulingFormat: MatchSchedulingFormat.Manual })).toBe(false);
      expect(
        hasGroupsTab({
          type: TournamentType.ACC,
          ballType: BallType.Leather,
          matchSchedulingFormat: MatchSchedulingFormat.Manual,
          groupCount: 0,
        }),
      ).toBe(false);
      expect(hasGroupsTab(undefined)).toBe(false);
    });
  });

  it('derives the unassigned pool and the all-assigned state', () => {
    const teams = [{ groupId: 'g1' }, { groupId: null }];
    expect(unassignedTeams(teams)).toEqual([{ groupId: null }]);
    expect(allTeamsAssigned(teams)).toBe(false);
    expect(allTeamsAssigned([{ groupId: 'g1' }, { groupId: 'g2' }])).toBe(true);
    expect(allTeamsAssigned([])).toBe(false);
  });

  it('diffs a group edit into add / remove team ids', () => {
    expect(groupMemberDiff(['a', 'b'], ['b', 'c'])).toEqual({ addTeamIds: ['c'], removeTeamIds: ['a'] });
    expect(groupMemberDiff(['a'], ['a'])).toEqual({ addTeamIds: [], removeTeamIds: [] });
  });

  it('formats match day in UTC and falls back to Date TBD', () => {
    expect(formatMatchWhen({ matchDate: '2026-07-11', startTime: null })).toBe('Sat, Jul 11, 2026');
    expect(formatMatchWhen({ matchDate: null, startTime: null })).toBe('Date TBD');
    expect(formatMatchWhen({ matchDate: '2026-07-11', startTime: '2026-07-11T13:30:00.000Z' })).toMatch(
      /^Sat, Jul 11, 2026 · /,
    );
  });

  it('splits a card score line into score and overs', () => {
    expect(splitScoreLine('47/1 (3.0)')).toEqual({ score: '47/1', overs: '3.0' });
    expect(splitScoreLine('Yet to Bat')).toEqual({ score: 'Yet to Bat', overs: null });
  });

  it('hides soft-deleted fixtures', () => {
    const rows = [{ id: 'a' }, { id: 'b', isDeleted: true }] as Pick<MatchListItem, 'id' | 'isDeleted'>[];
    expect(visibleMatches(rows as MatchListItem[]).map((m) => m.id)).toEqual(['a']);
  });

  it('resolves scorecard names and innings sides', () => {
    const card: Pick<ScorecardResponse, 'display'> = {
      display: {
        players: { p1: 'Aarav Patel' },
        innings: [
          {
            inningsId: 'i1',
            battingTeamId: 't1',
            battingTeamName: 'Hornets',
            battingTeamLogoUrl: 'https://logo',
            bowlingTeamId: 't2',
            bowlingTeamName: 'Fury',
          },
        ],
      },
    };
    const nameOf = scorecardNameResolver(card);
    expect(nameOf('p1')).toBe('Aarav Patel');
    expect(nameOf('missing')).toBe('Unknown player');
    expect(inningsTeams(card, { inningsId: 'i1', battingTeamId: 't1', bowlingTeamId: 't2' })).toEqual({
      batting: 'Hornets',
      bowling: 'Fury',
      battingLogoUrl: 'https://logo',
    });
    expect(
      formatFallOfWicketsLine(
        { fallOfWickets: [{ wicketNumber: 1, playerId: 'p1', teamRuns: 12, oversText: '2.3' }] },
        nameOf,
      ),
    ).toBe('1-12 (Aarav Patel, 2.3 ov)');
  });

  it('builds the six top-10 cards with the right metric per category', () => {
    const cards = buildLeaderCards(
      {
        batting: { entries: [batter('big', 80, 60), batter('cameo', 12, 2), batter('quick', 30, 12)] },
        bowling: { entries: [bowler('wkts', 4, 7.5, 24), bowler('tidy', 1, 4.25, 12), bowler('short', 0, 1, 6)] },
      },
      { mostSixes: [boundary('six', 5)], mostFours: [boundary('four', 9)] },
    );
    expect(cards.map((c) => c.title)).toEqual([
      'Batting',
      'Bowling',
      'Most sixes',
      'Most 4s',
      'Best economy',
      'Best strike rate',
    ]);
    const byId = Object.fromEntries(cards.map((c) => [c.id, c.rows.map((r) => `${r.userId}:${r.value}`)]));
    expect(byId.batting).toEqual(['big:80', 'cameo:12', 'quick:30']);
    expect(byId.bowling).toEqual(['wkts:4', 'tidy:1']);
    expect(byId.sixes).toEqual(['six:5']);
    expect(byId.fours).toEqual(['four:9']);
    expect(byId.economy).toEqual(['tidy:4.25', 'wkts:7.50']);
    expect(byId.strikeRate).toEqual(['quick:250.00', 'big:133.33']);
  });

  it('renders empty cards before data arrives', () => {
    expect(buildLeaderCards(undefined, undefined).every((c) => c.rows.length === 0)).toBe(true);
  });
});
