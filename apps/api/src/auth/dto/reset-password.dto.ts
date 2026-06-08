import { OTP_LENGTH, PASSWORD_MIN_LENGTH, type ResetPasswordRequest } from '@acc/types';
import { IsString, Length, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto implements ResetPasswordRequest {
  @IsString()
  @MinLength(1)
  mobileNumber!: string;

  @IsString()
  @Length(OTP_LENGTH, OTP_LENGTH, { message: `otp must be ${OTP_LENGTH} digits` })
  @Matches(/^[0-9]+$/, { message: 'otp must contain only digits' })
  otp!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `newPassword must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  @Matches(/[0-9]/, { message: 'newPassword must contain at least one digit' })
  newPassword!: string;
}
