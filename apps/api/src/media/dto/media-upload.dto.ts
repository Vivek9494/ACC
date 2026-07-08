import { IsIn, IsInt, IsString, Min } from 'class-validator';
import { IMAGE_UPLOAD_MIME_TYPE, type ImageUploadMimeType } from '@acc/types';

export class MediaUploadSessionDto {
  @IsIn([IMAGE_UPLOAD_MIME_TYPE])
  mimeType!: ImageUploadMimeType;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class MediaUploadCompleteDto {
  @IsString()
  storageKey!: string;

  @IsIn([IMAGE_UPLOAD_MIME_TYPE])
  mimeType!: ImageUploadMimeType;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
