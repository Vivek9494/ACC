import { BallType, type BallType as BallTypeValue } from '@acc/types';

/** Stable display order for played-ball-type icons on the Users list. */
export const PLAYED_BALL_TYPE_ORDER: readonly BallTypeValue[] = [
  BallType.Tennis,
  BallType.Leather,
];

const PARTICIPANT_FIELDS = [
  'strikerUserId',
  'nonStrikerUserId',
  'bowlerUserId',
  'fielderUserId',
  'fielder2UserId',
  'dismissedUserId',
] as const;

export type DeliveryBallTypeRow = {
  strikerUserId: string | null;
  nonStrikerUserId: string | null;
  bowlerUserId: string | null;
  fielderUserId: string | null;
  fielder2UserId: string | null;
  dismissedUserId: string | null;
  innings: {
    match: {
      tournament: { ballType: string };
    };
  };
};

/**
 * Folds delivery participant rows into per-user played ball types (indicator B).
 * Only userIds present in `pageUserIds` are retained.
 */
export function foldPlayedBallTypesByUser(
  rows: DeliveryBallTypeRow[],
  pageUserIds: readonly string[],
): Map<string, BallTypeValue[]> {
  const pageSet = new Set(pageUserIds);
  const sets = new Map<string, Set<BallTypeValue>>();

  for (const userId of pageUserIds) {
    sets.set(userId, new Set());
  }

  for (const row of rows) {
    const ballType = row.innings.match.tournament.ballType as BallTypeValue;
    if (ballType !== BallType.Tennis && ballType !== BallType.Leather) {
      continue;
    }
    for (const field of PARTICIPANT_FIELDS) {
      const userId = row[field];
      if (!userId || !pageSet.has(userId)) {
        continue;
      }
      sets.get(userId)?.add(ballType);
    }
  }

  const result = new Map<string, BallTypeValue[]>();
  for (const [userId, set] of sets) {
    result.set(
      userId,
      PLAYED_BALL_TYPE_ORDER.filter((type) => set.has(type)),
    );
  }
  return result;
}
