import { PlayingXiNoShowRecoveryAction, type PlayingXiNoShowRecoveryRequest } from '@acc/types';
import { IsEnum, IsString } from 'class-validator';

export class PlayingXiNoShowRecoveryDto implements PlayingXiNoShowRecoveryRequest {
  @IsString()
  absentUserId!: string;

  @IsEnum(PlayingXiNoShowRecoveryAction)
  action!: PlayingXiNoShowRecoveryAction;

  @IsString()
  replacementUserId!: string;
}
