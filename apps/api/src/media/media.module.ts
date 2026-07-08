import { Module } from '@nestjs/common';

import { MediaUploadService } from './media-upload.service';

@Module({
  providers: [MediaUploadService],
  exports: [MediaUploadService],
})
export class MediaModule {}
