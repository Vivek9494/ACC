import type { UnlockAccountRequest } from '@acc/types';
import { IsString, MinLength } from 'class-validator';

export class UnlockAccountDto implements UnlockAccountRequest {
  @IsString()
  @MinLength(1)
  userId!: string;
}
