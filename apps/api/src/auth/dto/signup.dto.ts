import {
  CANADIAN_POSTAL_CODE_REGEX,
  SIGNUP_ADDRESS_MAX_LENGTH,
  SIGNUP_MOBILE_LENGTH,
  SIGNUP_MOBILE_REGEX,
  SIGNUP_NAME_MAX_LENGTH,
  SIGNUP_NAME_REGEX,
  SIGNUP_VALIDATION_MESSAGES,
  type SignupRequest,
} from '@acc/types';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { APP_URL_VALIDATION_OPTIONS } from '../../common/validation/url-options';
import { IsPasswordPolicy } from '../validators/is-password-policy.decorator';

export class SignupDto implements SignupRequest {
  @IsString()
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.firstName.required })
  @MaxLength(SIGNUP_NAME_MAX_LENGTH, { message: SIGNUP_VALIDATION_MESSAGES.firstName.max })
  @Matches(SIGNUP_NAME_REGEX, { message: SIGNUP_VALIDATION_MESSAGES.firstName.invalid })
  firstName!: string;

  @IsString()
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.lastName.required })
  @MaxLength(SIGNUP_NAME_MAX_LENGTH, { message: SIGNUP_VALIDATION_MESSAGES.lastName.max })
  @Matches(SIGNUP_NAME_REGEX, { message: SIGNUP_VALIDATION_MESSAGES.lastName.invalid })
  lastName!: string;

  @IsString()
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.mobileNumber.required })
  @Matches(SIGNUP_MOBILE_REGEX, { message: SIGNUP_VALIDATION_MESSAGES.mobileNumber.invalid })
  @MaxLength(SIGNUP_MOBILE_LENGTH)
  mobileNumber!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value: unknown) => typeof value === 'string' && value.length > 0)
  @IsEmail({}, { message: SIGNUP_VALIDATION_MESSAGES.email.invalid })
  email?: string;

  @IsDateString({}, { message: SIGNUP_VALIDATION_MESSAGES.dateOfBirth.required })
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.dateOfBirth.required })
  dateOfBirth!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value: unknown) => typeof value === 'string' && value.length > 0)
  @IsString()
  @MaxLength(SIGNUP_ADDRESS_MAX_LENGTH)
  address?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value: unknown) => typeof value === 'string' && value.length > 0)
  @Matches(CANADIAN_POSTAL_CODE_REGEX, { message: SIGNUP_VALIDATION_MESSAGES.postalCode.invalid })
  postalCode?: string;

  @IsString()
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.center.required })
  centerId!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  jerseyNumber?: number;

  @IsOptional()
  @IsUrl(APP_URL_VALIDATION_OPTIONS)
  profilePhotoUrl?: string | null;

  @IsString()
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.emergencyContactName.required })
  @MaxLength(SIGNUP_NAME_MAX_LENGTH, {
    message: SIGNUP_VALIDATION_MESSAGES.emergencyContactName.max,
  })
  @Matches(SIGNUP_NAME_REGEX, {
    message: SIGNUP_VALIDATION_MESSAGES.emergencyContactName.invalid,
  })
  emergencyContactName!: string;

  @IsString()
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.emergencyContactNumber.required })
  @Matches(SIGNUP_MOBILE_REGEX, {
    message: SIGNUP_VALIDATION_MESSAGES.emergencyContactNumber.invalid,
  })
  @MaxLength(SIGNUP_MOBILE_LENGTH)
  emergencyContactNumber!: string;

  @IsString()
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.password.required })
  @IsPasswordPolicy()
  password!: string;
}
