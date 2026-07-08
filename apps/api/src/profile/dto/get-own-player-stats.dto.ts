import { BallType } from '@acc/types';
import { IsIn } from 'class-validator';

const BALL_TYPES = [BallType.Leather, BallType.Tennis] as const;

export class GetOwnPlayerStatsDto {
  @IsIn(BALL_TYPES)
  ballType!: BallType;
}
