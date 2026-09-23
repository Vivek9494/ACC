import type { LogoutRequest } from '@acc/types';
import { IsString, MinLength } from 'class-validator';

export class LogoutDto implements LogoutRequest {
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
