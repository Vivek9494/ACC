import { isMediaStorageKey } from '@acc/types';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AppSettingsService } from '../settings/app-settings.service';

const PRESIGNED_UPLOAD_EXPIRY_SECONDS = 3600;
const PRESIGNED_READ_EXPIRY_SECONDS = 3600;

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private clientCacheKey: string | null = null;
  private client: S3Client | null = null;
  private readonly bucket: string | undefined;
  private readonly region: string;
  private readonly publicApiUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: AppSettingsService,
  ) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET');
    this.region = this.config.get<string>('AWS_REGION') ?? 'ca-central-1';
    this.publicApiUrl = this.config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3001';
  }

  async isConfigured(): Promise<boolean> {
    const resolved = await this.resolveClient();
    return resolved != null;
  }

  async assertConfigured(): Promise<void> {
    if (!(await this.isConfigured())) {
      throw new BadRequestException({
        message:
          'Object storage is not configured. Set AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY (or start MinIO — see docker-compose.yml).',
        error: 'STORAGE_NOT_CONFIGURED',
      });
    }
  }

  async createPresignedUploadUrl(params: {
    storageKey: string;
    contentType: string;
    contentLength: number;
  }): Promise<{ uploadUrl: string; headers: Record<string, string> }> {
    const client = await this.requireClient();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.storageKey,
      ContentType: params.contentType,
      ContentLength: params.contentLength,
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: PRESIGNED_UPLOAD_EXPIRY_SECONDS,
    });

    return {
      uploadUrl,
      headers: { 'Content-Type': params.contentType },
    };
  }

  async createPresignedReadUrl(stored: string): Promise<string> {
    if (!stored.trim()) {
      return stored;
    }

    const externalUrl = this.resolveExternalLegacyUrl(stored);
    if (externalUrl) {
      return externalUrl;
    }

    const objectKey = this.resolveObjectKey(stored);
    if (!objectKey) {
      return stored;
    }

    if (!(await this.isConfigured())) {
      return this.localDevReadUrl(objectKey);
    }

    const client = await this.requireClient();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });

    return getSignedUrl(client, command, {
      expiresIn: PRESIGNED_READ_EXPIRY_SECONDS,
    });
  }

  async verifyUploadedObject(params: {
    storageKey: string;
    contentType: string;
    maxBytes: number;
    validateContentType?: (contentType: string) => boolean;
  }): Promise<number> {
    if (!(await this.isConfigured())) {
      return this.verifyLocalDevObject(params.storageKey, params.maxBytes);
    }

    const client = await this.requireClient();
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: params.storageKey,
      }),
    );

    const actualSize = head.ContentLength ?? 0;
    if (actualSize <= 0 || actualSize > params.maxBytes) {
      throw new BadRequestException({
        message: 'Uploaded file exceeds the allowed size',
        error: 'FILE_SIZE',
      });
    }

    const contentType = head.ContentType ?? '';
    if (params.validateContentType && !params.validateContentType(contentType)) {
      throw new BadRequestException({
        message: 'Uploaded file type is not allowed',
        error: 'FILE_TYPE',
      });
    }

    return actualSize;
  }

  async deleteObject(stored: string | null | undefined): Promise<void> {
    const objectKey = this.resolveObjectKey(stored);
    if (!objectKey || !(await this.isConfigured())) {
      return;
    }

    try {
      const client = await this.requireClient();
      await client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );
    } catch (err) {
      this.logger.warn(`Failed to delete object ${objectKey}: ${String(err)}`);
    }
  }

  /** Dev-only fallback when S3 is not configured — writes under uploads/{storageKey}. */
  async storeLocalDevObject(storageKey: string, buffer: Buffer): Promise<void> {
    const filePath = join(process.cwd(), 'uploads', storageKey);
    await mkdir(join(filePath, '..'), { recursive: true });
    await writeFile(filePath, buffer);
    this.logger.log(`Stored object locally at uploads/${storageKey} (S3 not configured)`);
  }

  isStorageKey(value: string): boolean {
    return this.resolveObjectKey(value) != null;
  }

  /** @deprecated Prefer {@link resolveObjectKey} — kept for callers that branch on URL shape. */
  isLegacyPublicUrl(value: string): boolean {
    const trimmed = value.trim();
    if (trimmed.startsWith('/uploads/')) {
      return true;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return false;
    }
    const objectKey = this.extractS3ObjectKeyFromUrl(trimmed);
    return objectKey == null || !isMediaStorageKey(objectKey);
  }

  /** Normalize a DB-stored value to an S3 object key, when possible. */
  resolveObjectKey(stored: string | null | undefined): string | null {
    if (!stored?.trim()) {
      return null;
    }
    const trimmed = stored.trim();
    if (isMediaStorageKey(trimmed)) {
      return trimmed;
    }
    if (trimmed.startsWith('/uploads/')) {
      return trimmed.slice('/uploads/'.length);
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const fromS3 = this.extractS3ObjectKeyFromUrl(trimmed);
      return fromS3 && isMediaStorageKey(fromS3) ? fromS3 : null;
    }
    return trimmed;
  }

  /** External http(s) URLs that are not our S3 objects (legacy public links). */
  private resolveExternalLegacyUrl(stored: string): string | null {
    const trimmed = stored.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return null;
    }
    const objectKey = this.extractS3ObjectKeyFromUrl(trimmed);
    if (objectKey && isMediaStorageKey(objectKey)) {
      return null;
    }
    return trimmed;
  }

  private extractS3ObjectKeyFromUrl(urlString: string): string | null {
    try {
      const url = new URL(urlString);
      const pathname = decodeURIComponent(url.pathname);
      if (url.hostname.startsWith('s3.') && this.bucket) {
        const segments = pathname.split('/').filter(Boolean);
        if (segments[0] === this.bucket && segments.length > 1) {
          return segments.slice(1).join('/');
        }
      }
      const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;
      return key.length > 0 ? key : null;
    } catch {
      return null;
    }
  }

  private localDevReadUrl(storageKey: string): string {
    return `${this.publicApiUrl.replace(/\/$/, '')}/uploads/${storageKey}`;
  }

  private async resolveClient(): Promise<S3Client | null> {
    if (!this.bucket) {
      return null;
    }

    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = await this.settings.getAwsSecretAccessKey();
    if (!accessKeyId || !secretAccessKey) {
      this.client = null;
      this.clientCacheKey = null;
      return null;
    }

    const endpoint = this.config.get<string>('AWS_S3_ENDPOINT');
    const cacheKey = `${accessKeyId}:${secretAccessKey}:${this.region}:${endpoint ?? ''}`;
    if (this.client && this.clientCacheKey === cacheKey) {
      return this.client;
    }

    this.client = new S3Client({
      region: this.region,
      endpoint: endpoint || undefined,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });
    this.clientCacheKey = cacheKey;
    return this.client;
  }

  private async requireClient(): Promise<S3Client> {
    await this.assertConfigured();
    const client = await this.resolveClient();
    if (!client) {
      throw new BadRequestException({
        message: 'Object storage is not configured.',
        error: 'STORAGE_NOT_CONFIGURED',
      });
    }
    return client;
  }

  private async verifyLocalDevObject(storageKey: string, maxBytes: number): Promise<number> {
    const filePath = join(process.cwd(), 'uploads', storageKey);
    const { stat } = await import('node:fs/promises');
    try {
      const info = await stat(filePath);
      if (info.size <= 0 || info.size > maxBytes) {
        throw new BadRequestException({
          message: 'Uploaded file exceeds the allowed size',
          error: 'FILE_SIZE',
        });
      }
      return info.size;
    } catch {
      throw new BadRequestException({
        message: 'Uploaded file was not found. Upload the file before completing.',
        error: 'FILE_NOT_FOUND',
      });
    }
  }
}
