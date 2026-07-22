import type { LoginRequest } from '@acc/types';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @IsString()
  @MinLength(1)
  mobileNumber!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
