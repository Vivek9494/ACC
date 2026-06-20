import { type ForgotPasswordRequest } from '@acc/types';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

import { normalizeMobileDto } from '../normalize-mobile.util';

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @Transform(({ value }: { value: unknown }) => normalizeMobileDto(value))
  @IsString()
  mobileNumber!: string;
}
