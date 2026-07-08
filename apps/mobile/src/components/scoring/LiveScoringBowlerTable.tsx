import type { BowlerCard } from '@acc/types';

import {
  BowlerFiguresScrollTable,
  type BowlerFiguresRow,
} from './BowlerFiguresScrollTable';

export interface LiveScoringBowlerTableProps {
  rows: BowlerFiguresRow[];
}

const EMPTY_BOWLER_CARD = {
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
} satisfies BowlerCard;

/** Innings bowler figures for the live scoring Bowling card (display-only). */
export function LiveScoringBowlerTable({ rows }: LiveScoringBowlerTableProps): React.ReactElement {
  const normalizedRows = rows.map((row) => ({
    ...row,
    card: row.card ?? EMPTY_BOWLER_CARD,
  }));

  return <BowlerFiguresScrollTable rows={normalizedRows} />;
}
