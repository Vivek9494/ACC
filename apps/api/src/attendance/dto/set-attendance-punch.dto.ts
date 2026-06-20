import { type SetAttendancePunchRequest } from '@acc/types';
import { IsISO8601 } from 'class-validator';

export class SetAttendancePunchDto implements SetAttendancePunchRequest {
  @IsISO8601()
  punchTimeUtc!: string;
}
