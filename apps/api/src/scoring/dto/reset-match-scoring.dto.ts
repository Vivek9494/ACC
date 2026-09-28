import type { ResetMatchScoringRequest } from '@acc/types';
import { IsInt, Min } from 'class-validator';

export class ResetMatchScoringDto implements ResetMatchScoringRequest {
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
