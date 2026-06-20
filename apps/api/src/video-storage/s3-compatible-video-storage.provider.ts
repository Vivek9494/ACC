import {
  isPlayerSkillVideoMimeType,
  PLAYER_SKILL_VIDEO_MAX_BYTES,
  playerSkillVideoSizeError,
  playerSkillVideoTypeError,
  type PlayerSkillVideoMimeType,
} from '@acc/types';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HeadObjectCommand, PutObjectCommand, S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type {
  VideoStorageProvider,
  VideoUploadTarget,
  VideoUploadTargetParams,
  VideoVerifyParams,
} from './video-storage.provider';

const PRESIGNED_URL_EXPIRY_SECONDS = 3600;

/**
 * S3-compatible storage (AWS S3 in ca-central-1, or MinIO / R2 / Supabase via endpoint override).
 * This is the production adapter and the recommended local-dev stub (MinIO in docker-compose).
 */
@Injectable()
export class S3CompatibleVideoStorageProvider implements VideoStorageProvider {
  private readonly logger = new Logger(S3CompatibleVideoStorageProvider.name);
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;
  private readonly region: string;
  private readonly publicBaseUrl: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('VIDEO_STORAGE_BUCKET');
    this.region = this.config.get<string>('VIDEO_STORAGE_REGION') ?? 'ca-central-1';
    const endpoint = this.config.get<string>('VIDEO_STORAGE_ENDPOINT');
    const accessKeyId = this.config.get<string>('VIDEO_STORAGE_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('VIDEO_STORAGE_SECRET_ACCESS_KEY');
    this.publicBaseUrl = this.config.get<string>('VIDEO_STORAGE_PUBLIC_BASE_URL');

    this.client =
      this.bucket && accessKeyId && secretAccessKey
        ? new S3Client({
            region: this.region,
            endpoint: endpoint || undefined,
            forcePathStyle: Boolean(endpoint),
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  isConfigured(): boolean {
    return this.client != null && Boolean(this.bucket);
  }

  async getUploadTarget(params: VideoUploadTargetParams): Promise<VideoUploadTarget> {
    this.assertConfigured();
    this.validateMeta(params.mimeType, params.sizeBytes);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.storageKey,
      ContentType: params.mimeType,
      ContentLength: params.sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.client!, command, {
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    });

    return {
      uploadMethod: 'PUT',
      uploadUrl,
      storageKey: params.storageKey,
      playbackUrl: this.getPlaybackUrl(params.storageKey),
      headers: { 'Content-Type': params.mimeType },
    };
  }

  async verifyUploadedObject(params: VideoVerifyParams): Promise<void> {
    this.assertConfigured();
    this.validateMeta(params.mimeType, params.sizeBytes);

    const head = await this.client!.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: params.storageKey,
      }),
    );

    const actualSize = head.ContentLength ?? 0;
    if (actualSize <= 0 || actualSize > PLAYER_SKILL_VIDEO_MAX_BYTES) {
      throw new BadRequestException({
        message: playerSkillVideoSizeError(),
        error: 'VIDEO_SIZE',
      });
    }

    const contentType = head.ContentType ?? '';
    if (!isPlayerSkillVideoMimeType(contentType)) {
      throw new BadRequestException({
        message: playerSkillVideoTypeError(),
        error: 'VIDEO_TYPE',
      });
    }
  }

  getPlaybackUrl(storageKey: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`;
    }
    if (this.bucket) {
      const endpoint = this.config.get<string>('VIDEO_STORAGE_ENDPOINT');
      if (endpoint) {
        return `${endpoint.replace(/\/$/, '')}/${this.bucket}/${storageKey}`;
      }
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${storageKey}`;
    }
    return storageKey;
  }

  async deleteObject(storageKey: string): Promise<void> {
    if (!this.client || !this.bucket) {
      return;
    }
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        }),
      );
    } catch (err) {
      this.logger.warn(`Failed to delete skill video object ${storageKey}: ${String(err)}`);
    }
  }

  private assertConfigured(): void {
    if (!this.client || !this.bucket) {
      throw new BadRequestException({
        message:
          'Video storage is not configured. Set VIDEO_STORAGE_BUCKET and credentials, or start MinIO (see docker-compose.yml).',
        error: 'VIDEO_STORAGE_NOT_CONFIGURED',
      });
    }
  }

  private validateMeta(mimeType: string, sizeBytes: number): PlayerSkillVideoMimeType {
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > PLAYER_SKILL_VIDEO_MAX_BYTES) {
      throw new BadRequestException({
        message: playerSkillVideoSizeError(),
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
