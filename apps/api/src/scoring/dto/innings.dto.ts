import {
  InningsType,
  type SetDlsTargetRequest,
  type StartInningsRequest,
  type UpdateOversAllottedRequest,
} from '@acc/types';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const INNINGS_TYPES = Object.values(InningsType);

export class StartInningsDto implements StartInningsRequest {
  @IsOptional()
  @IsIn(INNINGS_TYPES)
  inningsType?: InningsType;

  @IsOptional()
  @IsString()
  battingTeamId?: string | null;

  @IsOptional()
  @IsString()
  bowlingTeamId?: string | null;

  @IsOptional()
  @IsBoolean()
  battingIsExternal?: boolean;

  @IsOptional()
  @IsBoolean()
  bowlingIsExternal?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  oversAllotted?: number | null;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class SetDlsTargetDto implements SetDlsTargetRequest {
  @IsOptional()
  @IsInt()
  @Min(1)
  originalTarget?: number | null;

  @IsInt()
  @Min(1)
  dlsTarget!: number;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class UpdateOversAllottedDto implements UpdateOversAllottedRequest {
  @IsString()
  inningsId!: string;

  @IsInt()
  @Min(1)
  oversAllotted!: number;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
