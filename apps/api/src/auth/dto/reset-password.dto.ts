import { OTP_LENGTH, type ResetPasswordRequest } from '@acc/types';
import { IsString, Length, Matches, MinLength } from 'class-validator';

import { IsPasswordPolicy } from '../validators/is-password-policy.decorator';

export class ResetPasswordDto implements ResetPasswordRequest {
  @IsString()
  @MinLength(1)
  mobileNumber!: string;

  @IsString()
  @Length(OTP_LENGTH, OTP_LENGTH, { message: `otp must be ${OTP_LENGTH} digits` })
  @Matches(/^[0-9]+$/, { message: 'otp must contain only digits' })
  otp!: string;

  @IsString()
  @IsPasswordPolicy()
  newPassword!: string;
}
