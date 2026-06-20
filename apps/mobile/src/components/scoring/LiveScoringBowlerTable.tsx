import type { BowlerCard } from '@acc/types';

import { BowlerFiguresScrollTable } from './BowlerFiguresScrollTable';

export interface LiveScoringBowlerTableProps {
  name: string;
  card: BowlerCard | undefined;
  isCurrent: boolean;
}

/** Current-bowler figures for the live scoring Bowling card (display-only). */
export function LiveScoringBowlerTable({
  name,
  card,
  isCurrent,
}: LiveScoringBowlerTableProps): React.ReactElement {
  const figures: BowlerCard =
    card ??
    ({
      playerId: '',
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
    } satisfies BowlerCard);

  return (
    <BowlerFiguresScrollTable
      compact
      rows={[
        {
          id: figures.playerId || name,
          name,
          card: figures,
          highlightName: isCurrent,
          nameSuffix: isCurrent ? '*' : '',
        },
      ]}
    />
  );
}
