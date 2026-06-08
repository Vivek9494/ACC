import { MatchSide, type RecordTossRequest, TossDecision } from '@acc/types';
import { IsIn } from 'class-validator';

const SIDES = Object.values(MatchSide);
const DECISIONS = Object.values(TossDecision);

/** Toss data capture only — no animation (spec §11.2). */
export class RecordTossDto implements RecordTossRequest {
  @IsIn(SIDES)
  tossWinner!: MatchSide;

  @IsIn(DECISIONS)
  decision!: TossDecision;
}
