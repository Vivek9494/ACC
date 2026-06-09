import { PASSWORD_MIN_LENGTH, type SignupRequest } from '@acc/types';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SignupDto implements SignupRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'mobileNumber must be a valid phone number',
  })
  mobileNumber!: string;

  @IsEmail()
  email!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsString()
  @MinLength(1)
  centerId!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  jerseyNumber?: number;

  @IsOptional()
  @IsUrl()
  profilePhotoUrl?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  emergencyContactName!: string;

  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'emergencyContactNumber must be a valid phone number',
  })
  emergencyContactNumber!: string;

  // Security mitigation (§31): min 8 chars with at least one digit, overriding
  // the 6-char default.
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  @Matches(/[0-9]/, { message: 'password must contain at least one digit' })
  password!: string;
}
