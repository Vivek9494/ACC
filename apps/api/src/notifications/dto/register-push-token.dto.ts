import {
  PUSH_PLATFORM_VALUES,
  type PushPlatform,
  type RegisterPushTokenRequest,
  type UnregisterPushTokenRequest,
} from '@acc/types';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterPushTokenDto implements RegisterPushTokenRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  token!: string;

  @IsIn(PUSH_PLATFORM_VALUES)
  platform!: PushPlatform;
}

export class UnregisterPushTokenDto implements UnregisterPushTokenRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  token!: string;
}
