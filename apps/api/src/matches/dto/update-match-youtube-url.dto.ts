import type { UpdateMatchYoutubeUrlRequest } from '@acc/types';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMatchYoutubeUrlDto implements UpdateMatchYoutubeUrlRequest {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  youtubeUrl!: string | null;
}
