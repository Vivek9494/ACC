import { Global, Module } from '@nestjs/common';

import { AppSettingsModule } from '../settings/app-settings.module';
import { MediaUrlResolver } from './media-url.resolver';
import { S3StorageService } from './s3-storage.service';

@Global()
@Module({
  imports: [AppSettingsModule],
  providers: [S3StorageService, MediaUrlResolver],
  exports: [S3StorageService, MediaUrlResolver],
})
export class StorageModule {}
