import { type ResetPasswordRequest } from '@acc/types';
import { IsString, MinLength } from 'class-validator';

import { IsPasswordPolicy } from '../validators/is-password-policy.decorator';

export class ResetPasswordDto implements ResetPasswordRequest {
  @IsString()
  @MinLength(1)
  resetToken!: string;

  @IsString()
  @IsPasswordPolicy()
  newPassword!: string;
}
