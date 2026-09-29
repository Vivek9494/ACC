import { IsOptional, IsString, MaxLength } from 'class-validator';

import { BROADCAST_TEXT_MAX_LENGTH, type CreateBroadcastRequest } from '@acc/types';

export class CreateBroadcastDto implements CreateBroadcastRequest {
  @IsOptional()
  @IsString()
  @MaxLength(BROADCAST_TEXT_MAX_LENGTH)
  text?: string;

  /** S3 object key from broadcast image upload-session/complete flow. */
  @IsOptional()
  @IsString()
  imageStorageKey?: string;
}
