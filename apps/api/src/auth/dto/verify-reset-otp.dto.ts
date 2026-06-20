import { OTP_LENGTH, type VerifyResetOtpRequest } from '@acc/types';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

import { normalizeMobileDto } from '../normalize-mobile.util';

export class VerifyResetOtpDto implements VerifyResetOtpRequest {
  @Transform(({ value }: { value: unknown }) => normalizeMobileDto(value))
  @IsString()
  mobileNumber!: string;

  @IsString()
  @Length(OTP_LENGTH, OTP_LENGTH, { message: `otp must be ${OTP_LENGTH} digits` })
  @Matches(/^[0-9]+$/, { message: 'otp must contain only digits' })
  otp!: string;
}
