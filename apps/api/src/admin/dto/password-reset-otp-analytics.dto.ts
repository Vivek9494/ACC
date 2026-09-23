import { IsDateString, IsNotEmpty } from 'class-validator';

/** Query for GET /admin/password-reset-otp/daily — inclusive UTC date bounds. */
export class PasswordResetOtpDailyQueryDto {
  @IsDateString()
  @IsNotEmpty()
  fromDate!: string;

  @IsDateString()
  @IsNotEmpty()
  toDate!: string;
}

/** Query for GET /admin/password-reset-otp/by-day — single UTC calendar day. */
export class PasswordResetOtpByDayQueryDto {
  @IsDateString()
  @IsNotEmpty()
  date!: string;
}
