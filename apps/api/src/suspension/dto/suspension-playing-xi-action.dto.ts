import { IsOptional, IsUUID } from 'class-validator';

/** Optional context for auditing; authorization uses the suspension row. */
export class SuspensionPlayingXiActionDto {
  @IsOptional()
  @IsUUID()
  matchId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
