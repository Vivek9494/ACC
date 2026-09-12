import {
  BallType,
  InningsType,
  MatchSchedulingFormat,
  MatchState,
  TournamentType,
} from '@acc/types';
import { Test, TestingModule } from '@nestjs/testing';

import { StandingsService } from './standings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { TennisTournamentVisibilityService } from '../tournaments/tennis-tournament-visibility.service';

type MatchFixture = {
  id: string;
  state: MatchState;
  isDeleted: boolean;
  groupId: string | null;
  homeTeamId: string;
  awayTeamId: string;
  winningTeamId: string;
  isNoResult: boolean;
  /** team-a's score; team-b always makes 120. Differs per match so NRR moves. */
  homeRuns: number;
};

/** Two completed fixtures — team-a beat team-b in both, by different margins. */
function fixtures(secondIsDeleted: boolean): MatchFixture[] {
  return [
    {
      id: 'match-1',
      state: MatchState.Completed,
      isDeleted: false,
      groupId: null,
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
      winningTeamId: 'team-a',
      isNoResult: false,
      homeRuns: 150,
    },
    {
      id: 'match-2',
      state: MatchState.Completed,
      isDeleted: secondIsDeleted,
      groupId: null,
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
      winningTeamId: 'team-a',
      isNoResult: false,
      homeRuns: 240,
    },
  ];
}

function scorecardFor(match: MatchFixture) {
  return {
    innings: [
      {
        inningsType: InningsType.Normal,
        battingTeamId: match.homeTeamId,
        bowlingTeamId: match.awayTeamId,
        runs: match.homeRuns,
        legalBalls: 120,
        closeReason: null,
        oversAllotted: 20,
      },
      {
        inningsType: InningsType.Normal,
        battingTeamId: match.awayTeamId,
        bowlingTeamId: match.homeTeamId,
        runs: 120,
        legalBalls: 120,
        closeReason: null,
        oversAllotted: 20,
      },
    ],
    result: {
      decided: true,
      winningTeamId: match.winningTeamId,
      isNoResult: false,
      superOverRequired: false,
    },
  };
}

async function standingsWith(secondIsDeleted: boolean) {
  const rows = fixtures(secondIsDeleted);
  const prismaMock = {
    tournament: {
      findUnique: jest.fn(
        async (args: { include: { matches: { where: { isDeleted: boolean } } } }) => ({
          id: 'tour-1',
          isDeleted: false,
          type: TournamentType.APL,
          ballType: BallType.Tennis,
          matchSchedulingFormat: MatchSchedulingFormat.Manual,
          _count: { groups: 0 },
          groups: [],
          teams: [
            { id: 'team-a', name: 'Team A', logoUrl: null, groupId: null },
            { id: 'team-b', name: 'Team B', logoUrl: null, groupId: null },
          ],
          // Mirror the Prisma relation filter the service asks for.
          matches: rows.filter(
            (row) => row.isDeleted === args.include.matches.where.isDeleted,
          ),
        }),
      ),
    },
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StandingsService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: ScorecardReader, useValue: { build: jest.fn(async (m: MatchFixture) => scorecardFor(m)) } },
      { provide: MediaUrlResolver, useValue: { resolveReadUrl: jest.fn(async () => null) } },
      {
        provide: TennisTournamentVisibilityService,
        useValue: { assertCanViewCenterLevelTournament: jest.fn().mockResolvedValue(undefined) },
      },
    ],
  }).compile();

  const standings = await module.get(StandingsService).getStandings('tour-1');
  const teams = standings.tables[0]!.teams;
  return {
    teamA: teams.find((row) => row.teamId === 'team-a')!,
    teamB: teams.find((row) => row.teamId === 'team-b')!,
  };
}

describe('StandingsService — soft-deleted matches', () => {
  it('counts both fixtures while neither is deleted', async () => {
    const { teamA, teamB } = await standingsWith(false);

    expect(teamA).toMatchObject({ matches: 2, wins: 2, losses: 0, points: 4 });
    expect(teamB).toMatchObject({ matches: 2, wins: 0, losses: 2, points: 0 });
  });

  it('drops the deleted fixture from matches played, points and net run rate', async () => {
    const before = await standingsWith(false);
    const after = await standingsWith(true);

    expect(after.teamA).toMatchObject({ matches: 1, wins: 1, losses: 0, points: 2 });
    expect(after.teamB).toMatchObject({ matches: 1, wins: 0, losses: 1, points: 0 });
    expect(after.teamA.points).toBeLessThan(before.teamA.points);

    // The opponent's NRR moves too, even though its own results did not change.
    expect(after.teamA.netRunRate).toBeLessThan(before.teamA.netRunRate);
    expect(after.teamB.netRunRate).toBeGreaterThan(before.teamB.netRunRate);
  });
});
