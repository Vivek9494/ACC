import {
  CANADIAN_POSTAL_CODE_REGEX,
  JERSEY_SIZE_OPTIONS,
  SIGNUP_ADDRESS_MAX_LENGTH,
  SIGNUP_MOBILE_LENGTH,
  SIGNUP_MOBILE_REGEX,
  SIGNUP_NAME_MAX_LENGTH,
  SIGNUP_NAME_REGEX,
  SIGNUP_VALIDATION_MESSAGES,
  type UpdateProfileRequest,
} from '@acc/types';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto implements UpdateProfileRequest {
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
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.province.required })
  provinceId!: string;

  @IsString()
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.center.required })
  centerId!: string;

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

  @IsOptional()
  @IsUrl()
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

  @IsBoolean()
  hasHealthCard!: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value: unknown) => typeof value === 'string' && value.length > 0)
  @IsString()
  @MaxLength(SIGNUP_NAME_MAX_LENGTH)
  @Matches(SIGNUP_NAME_REGEX)
  jerseyName?: string | null;

  @IsOptional()
  @IsIn([...JERSEY_SIZE_OPTIONS])
  jerseySize?: UpdateProfileRequest['jerseySize'];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  jerseyNumber?: number;
}
