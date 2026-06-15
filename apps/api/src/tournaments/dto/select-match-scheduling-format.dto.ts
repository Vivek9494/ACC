import { MatchSchedulingFormat, type SelectMatchSchedulingFormatRequest } from '@acc/types';
import { IsIn } from 'class-validator';

const FORMATS = Object.values(MatchSchedulingFormat);

export class SelectMatchSchedulingFormatDto implements SelectMatchSchedulingFormatRequest {
  @IsIn(FORMATS)
  schedulingFormat!: MatchSchedulingFormat;
}
