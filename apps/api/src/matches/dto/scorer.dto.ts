import { type AssignScorerRequest, type HandoverScorerRequest } from '@acc/types';
import { IsOptional, IsString } from 'class-validator';

/** Assign a per-match Scorer (§11.1). */
export class AssignScorerDto implements AssignScorerRequest {
  @IsString()
  userId!: string;
}

/** Mid-match Scorer handover (§11.1). */
export class HandoverScorerDto implements HandoverScorerRequest {
  @IsOptional()
  @IsString()
  fromUserId?: string | null;

  @IsString()
  toUserId!: string;
}
