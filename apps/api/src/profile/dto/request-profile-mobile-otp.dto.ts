import {
  SIGNUP_MOBILE_LENGTH,
  SIGNUP_MOBILE_REGEX,
  SIGNUP_VALIDATION_MESSAGES,
  type RequestProfileMobileOtpRequest,
} from '@acc/types';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class RequestProfileMobileOtpDto implements RequestProfileMobileOtpRequest {
  @IsString()
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.mobileNumber.required })
  @Matches(SIGNUP_MOBILE_REGEX, { message: SIGNUP_VALIDATION_MESSAGES.mobileNumber.invalid })
  @MaxLength(SIGNUP_MOBILE_LENGTH)
  newMobileNumber!: string;
}
