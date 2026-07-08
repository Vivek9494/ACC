import { IMAGE_UPLOAD_MAX_MB_MAX, VIDEO_UPLOAD_MAX_MB_MAX } from '@acc/types';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateAdminAppSettingsDto {
  @IsInt()
  @Min(1)
  @Max(VIDEO_UPLOAD_MAX_MB_MAX)
  videoUploadMaxMb!: number;

  @IsInt()
  @Min(1)
  @Max(IMAGE_UPLOAD_MAX_MB_MAX)
  imageUploadMaxMb!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  googleMapsApiKey!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(256)
  awsKey?: string;
}
