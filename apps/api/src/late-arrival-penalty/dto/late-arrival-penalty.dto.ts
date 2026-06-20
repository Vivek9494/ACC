import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class DesignatePenaltyServeDto {
  @IsUUID()
  serveMatchId!: string;
}

export class CancelLateArrivalPenaltyDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
