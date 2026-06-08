import type { ForgotPasswordRequest } from '@acc/types';
import { IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @IsString()
  @MinLength(1)
  mobileNumber!: string;
}
