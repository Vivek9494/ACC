import { IsIn, IsInt } from 'class-validator';

import { MATCH_DELAY_DURATION_MINUTES } from '@acc/types';

export class DelayMatchDto {
  @IsInt()
  @IsIn([...MATCH_DELAY_DURATION_MINUTES])
  delayMinutes!: number;
}
