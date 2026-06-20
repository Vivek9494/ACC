import { Injectable, Module } from '@nestjs/common';

import { S3CompatibleVideoStorageProvider } from './s3-compatible-video-storage.provider';
import { VIDEO_STORAGE_PROVIDER, type VideoStorageProvider } from './video-storage.provider';

@Injectable()
export class VideoStorageProviderFactory {
  constructor(private readonly s3Compatible: S3CompatibleVideoStorageProvider) {}

  resolve(): VideoStorageProvider {
    return this.s3Compatible;
  }
}

export const videoStorageProviderFactory = {
  provide: VIDEO_STORAGE_PROVIDER,
  useFactory: (factory: VideoStorageProviderFactory): VideoStorageProvider => factory.resolve(),
  inject: [VideoStorageProviderFactory],
};

@Module({
  providers: [
    S3CompatibleVideoStorageProvider,
    VideoStorageProviderFactory,
    videoStorageProviderFactory,
  ],
  exports: [VIDEO_STORAGE_PROVIDER, S3CompatibleVideoStorageProvider],
})
export class VideoStorageModule {}

export { VIDEO_STORAGE_PROVIDER } from './video-storage.provider';
