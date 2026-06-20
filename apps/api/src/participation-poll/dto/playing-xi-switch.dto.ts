import { type PlayingXiSwitchRequest } from '@acc/types';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class PlayingXiSwitchDto implements PlayingXiSwitchRequest {
  @IsString()
  replacedUserId!: string;

  @IsString()
  replacementUserId!: string;

  @IsOptional()
  @IsBoolean()
  confirmPenaltyCancellation?: boolean;
}
