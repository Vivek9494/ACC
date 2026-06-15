import { MatchSide, TossDecision, type StartMatchSetupRequest } from '@acc/types';
import { IsEnum, IsString } from 'class-validator';

/** Toss + opening players; transitions the match to Live (§11). */
export class StartMatchSetupDto implements StartMatchSetupRequest {
  @IsEnum(MatchSide)
  tossWinner!: MatchSide;

  @IsEnum(TossDecision)
  tossDecision!: TossDecision;

  @IsString()
  strikerUserId!: string;

  @IsString()
  nonStrikerUserId!: string;

  @IsString()
  bowlerUserId!: string;
}
