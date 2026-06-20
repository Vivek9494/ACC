import { type AutoAttendancePunchRequest } from '@acc/types';
import { IsISO8601, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class AutoAttendancePunchDto implements AutoAttendancePunchRequest {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsISO8601()
  capturedAt?: string;
}
