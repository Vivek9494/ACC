import type { ConfirmScorecardRequest, SelectManOfMatchRequest } from '@acc/types';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmScorecardDto implements ConfirmScorecardRequest {
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersion?: number;
}

export class SelectManOfMatchDto implements SelectManOfMatchRequest {
  @IsString()
  userId!: string;
}
