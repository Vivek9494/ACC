import { PLAYING_XI_SIZE, type ConfirmPollPlayingXiRequest } from '@acc/types';
import { ArrayMinSize, ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';

export class ConfirmPollPlayingXiDto implements ConfirmPollPlayingXiRequest {
  @IsArray()
  @ArrayMinSize(PLAYING_XI_SIZE)
  @ArrayMaxSize(PLAYING_XI_SIZE)
  @ArrayUnique()
  @IsString({ each: true })
  playingXi!: string[];

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  substitutes!: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  penaltyServerUserIds: string[] = [];
}
