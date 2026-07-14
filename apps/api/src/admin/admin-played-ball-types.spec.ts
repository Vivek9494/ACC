import { BallType } from '@acc/types';

import {
  foldPlayedBallTypesByUser,
  type DeliveryBallTypeRow,
} from './admin-played-ball-types';

function row(
  overrides: Partial<DeliveryBallTypeRow> & {
    ballType?: string;
  },
): DeliveryBallTypeRow {
  const { ballType = BallType.Tennis, ...rest } = overrides;
  return {
    strikerUserId: null,
    nonStrikerUserId: null,
    bowlerUserId: null,
    fielderUserId: null,
    fielder2UserId: null,
    dismissedUserId: null,
    innings: {
      match: {
        tournament: { ballType },
      },
    },
    ...rest,
  };
}

describe('foldPlayedBallTypesByUser', () => {
  it('returns empty arrays for users with no delivery participation', () => {
    const result = foldPlayedBallTypesByUser([], ['u1', 'u2']);
    expect(result.get('u1')).toEqual([]);
    expect(result.get('u2')).toEqual([]);
  });

  it('attributes tennis and leather from any participant column', () => {
    const result = foldPlayedBallTypesByUser(
      [
        row({ strikerUserId: 'u1', ballType: BallType.Tennis }),
        row({ bowlerUserId: 'u1', ballType: BallType.Leather }),
        row({ fielderUserId: 'u2', ballType: BallType.Tennis }),
      ],
      ['u1', 'u2', 'u3'],
    );

    expect(result.get('u1')).toEqual([BallType.Tennis, BallType.Leather]);
    expect(result.get('u2')).toEqual([BallType.Tennis]);
    expect(result.get('u3')).toEqual([]);
  });

  it('ignores participant userIds outside the page', () => {
    const result = foldPlayedBallTypesByUser(
      [row({ dismissedUserId: 'other', ballType: BallType.Leather })],
      ['u1'],
    );
    expect(result.get('u1')).toEqual([]);
  });
});
