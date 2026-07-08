import {
  isPlayerSkillVideoMimeType,
  playerSkillVideoSizeError,
  playerSkillVideoTypeError,
  type PlayerSkillVideoMimeType,
} from '@acc/types';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { AppSettingsService } from '../settings/app-settings.service';
import { S3StorageService } from '../storage/s3-storage.service';
import type {
  VideoStorageProvider,
  VideoUploadTarget,
  VideoUploadTargetParams,
  VideoVerifyParams,
} from './video-storage.provider';

@Injectable()
export class S3CompatibleVideoStorageProvider implements VideoStorageProvider {
  private readonly logger = new Logger(S3CompatibleVideoStorageProvider.name);

  constructor(
    private readonly storage: S3StorageService,
    private readonly settings: AppSettingsService,
  ) {}

  isConfigured(): Promise<boolean> {
    return this.storage.isConfigured();
  }

  async getUploadTarget(params: VideoUploadTargetParams): Promise<VideoUploadTarget> {
    await this.assertConfigured();
    const maxBytes = await this.settings.getVideoUploadMaxBytes();
    this.validateMeta(params.mimeType, params.sizeBytes, maxBytes);

    const target = await this.storage.createPresignedUploadUrl({
      storageKey: params.storageKey,
      contentType: params.mimeType,
      contentLength: params.sizeBytes,
    });

    return {
      uploadMethod: 'PUT',
      uploadUrl: target.uploadUrl,
      storageKey: params.storageKey,
      playbackUrl: await this.storage.createPresignedReadUrl(params.storageKey),
      headers: target.headers,
    };
  }

  async verifyUploadedObject(params: VideoVerifyParams): Promise<void> {
    await this.assertConfigured();
    const maxBytes = await this.settings.getVideoUploadMaxBytes();
    this.validateMeta(params.mimeType, params.sizeBytes, maxBytes);

    await this.storage.verifyUploadedObject({
      storageKey: params.storageKey,
      contentType: params.mimeType,
      maxBytes,
      validateContentType: isPlayerSkillVideoMimeType,
    });
  }

  async getPlaybackUrl(storageKey: string): Promise<string> {
    return this.storage.createPresignedReadUrl(storageKey);
  }

  async deleteObject(storageKey: string): Promise<void> {
    await this.storage.deleteObject(storageKey);
  }

  private async assertConfigured(): Promise<void> {
    if (!(await this.isConfigured())) {
      throw new BadRequestException({
        message:
          'Video storage is not configured. Set AWS_S3_BUCKET and credentials, or start MinIO (see docker-compose.yml).',
        error: 'VIDEO_STORAGE_NOT_CONFIGURED',
      });
    }
  }

  private validateMeta(mimeType: string, sizeBytes: number, maxBytes: number): PlayerSkillVideoMimeType {
    const maxMb = Math.ceil(maxBytes / (1024 * 1024));
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new BadRequestException({
        message: playerSkillVideoSizeError(maxMb),
        error: 'VIDEO_SIZE',
      });
    }
    if (!isPlayerSkillVideoMimeType(mimeType)) {
      throw new BadRequestException({
        message: playerSkillVideoTypeError(),
        error: 'VIDEO_TYPE',
      });
    }
    return mimeType;
  }
}
