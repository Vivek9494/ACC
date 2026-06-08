import type { RefreshRequest } from '@acc/types';
import { IsString, MinLength } from 'class-validator';

export class RefreshDto implements RefreshRequest {
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
