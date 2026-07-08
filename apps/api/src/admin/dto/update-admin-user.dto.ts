import {
  ADMIN_ASSIGNABLE_ROLES,
  RATING_MAX,
  RATING_MIN,
  SIGNUP_NAME_MAX_LENGTH,
  SIGNUP_NAME_REGEX,
  SIGNUP_VALIDATION_MESSAGES,
  UserRole,
  type UpdateAdminUserRequest,
} from '@acc/types';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { normalizeMobileDto } from '../../auth/normalize-mobile.util';

export class UpdateAdminUserDto implements UpdateAdminUserRequest {
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

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @ValidateIf((_, value: unknown) => typeof value === 'string' && value.length > 0)
  @IsEmail({}, { message: SIGNUP_VALIDATION_MESSAGES.email.invalid })
  email?: string;

  @Transform(({ value }: { value: unknown }) => normalizeMobileDto(value))
  @IsString()
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.mobileNumber.required })
  mobileNumber!: string;

  @IsString()
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.province.required })
  provinceId!: string;

  @IsString()
  @IsNotEmpty({ message: SIGNUP_VALIDATION_MESSAGES.center.required })
  centerId!: string;

  @IsDateString({}, { message: SIGNUP_VALIDATION_MESSAGES.dateOfBirth.required })
  dateOfBirth!: string;

  @IsInt()
  @Min(0)
  @Max(999)
  jerseyNumber!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value: unknown) => typeof value === 'string' && value.length > 0)
  @IsString()
  @MaxLength(SIGNUP_NAME_MAX_LENGTH)
  @Matches(SIGNUP_NAME_REGEX)
  jerseyName?: string | null;

  @IsIn(ADMIN_ASSIGNABLE_ROLES)
  platformRole!: UserRole;

  @IsOptional()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  battingRating?: number | null;

  @IsOptional()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  bowlingRating?: number | null;

  @IsOptional()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  fieldingRating?: number | null;
}
