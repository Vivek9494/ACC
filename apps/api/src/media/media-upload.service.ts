import {
  buildBroadcastImageStorageKey,
  buildProfilePhotoStorageKey,
  buildTeamLogoStorageKey,
  buildTournamentPosterStorageKey,
  IMAGE_UPLOAD_MIME_TYPE,
  isImageUploadMimeType,
  profilePhotoSizeError,
  type ImageUploadMimeType,
  type MediaUploadCompleteRequest,
  type MediaUploadCompleteResponse,
  type MediaUploadSessionRequest,
  type MediaUploadSessionResponse,
  tournamentPosterSizeError,
  tournamentPosterTypeError,
  TOURNAMENT_POSTER_MAX_BYTES,
} from '@acc/types';
import { BadRequestException, Injectable } from '@nestjs/common';

import { AppSettingsService } from '../settings/app-settings.service';
import { S3StorageService } from '../storage/s3-storage.service';

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

@Injectable()
export class MediaUploadService {
  constructor(
    private readonly storage: S3StorageService,
    private readonly settings: AppSettingsService,
  ) {}

  async createProfilePhotoUploadSession(
    userId: string,
    dto: MediaUploadSessionRequest,
  ): Promise<MediaUploadSessionResponse> {
    await this.validateImageSession(dto, await this.settings.getImageUploadMaxBytes());
    const storageKey = buildProfilePhotoStorageKey(userId);
    return this.createSession(storageKey, dto.mimeType, dto.sizeBytes);
  }

  async completeProfilePhotoUpload(
    userId: string,
    dto: MediaUploadCompleteRequest,
  ): Promise<MediaUploadCompleteResponse> {
    this.assertProfilePhotoKey(userId, dto.storageKey);
    return this.completeImageUpload(dto, await this.settings.getImageUploadMaxBytes());
  }

  async createTournamentPosterUploadSession(
    userId: string,
  dto: MediaUploadSessionRequest,
  ): Promise<MediaUploadSessionResponse> {
    await this.validateImageSession(dto, TOURNAMENT_POSTER_MAX_BYTES);
    const storageKey = buildTournamentPosterStorageKey(userId);
    return this.createSession(storageKey, dto.mimeType, dto.sizeBytes);
  }

  async completeTournamentPosterUpload(
    userId: string,
    dto: MediaUploadCompleteRequest,
  ): Promise<MediaUploadCompleteResponse> {
    this.assertUserScopedKey(userId, dto.storageKey, 'posters/');
    return this.completeImageUpload(dto, TOURNAMENT_POSTER_MAX_BYTES);
  }

  async createTeamLogoUploadSession(
    userId: string,
    dto: MediaUploadSessionRequest,
  ): Promise<MediaUploadSessionResponse> {
    await this.validateImageSession(dto, TOURNAMENT_POSTER_MAX_BYTES);
    const storageKey = buildTeamLogoStorageKey(userId);
    return this.createSession(storageKey, dto.mimeType, dto.sizeBytes);
  }

  async completeTeamLogoUpload(
    userId: string,
    dto: MediaUploadCompleteRequest,
  ): Promise<MediaUploadCompleteResponse> {
    this.assertUserScopedKey(userId, dto.storageKey, 'team-logos/');
    return this.completeImageUpload(dto, TOURNAMENT_POSTER_MAX_BYTES);
  }

  async createBroadcastImageUploadSession(
    userId: string,
    dto: MediaUploadSessionRequest,
  ): Promise<MediaUploadSessionResponse> {
    await this.validateImageSession(dto, await this.settings.getImageUploadMaxBytes());
    const storageKey = buildBroadcastImageStorageKey(userId);
    return this.createSession(storageKey, dto.mimeType, dto.sizeBytes);
  }

  async completeBroadcastImageUpload(
    userId: string,
    dto: MediaUploadCompleteRequest,
  ): Promise<MediaUploadCompleteResponse> {
    this.assertUserScopedKey(userId, dto.storageKey, 'broadcasts/');
    return this.completeImageUpload(dto, await this.settings.getImageUploadMaxBytes());
  }

  private async createSession(
    storageKey: string,
    mimeType: ImageUploadMimeType,
    sizeBytes: number,
  ): Promise<MediaUploadSessionResponse> {
    await this.storage.assertConfigured();
    const target = await this.storage.createPresignedUploadUrl({
      storageKey,
      contentType: mimeType,
      contentLength: sizeBytes,
    });
    return {
      uploadMethod: 'PUT',
      uploadUrl: target.uploadUrl,
      storageKey,
      headers: target.headers,
    };
  }

  private async completeImageUpload(
    dto: MediaUploadCompleteRequest,
    maxBytes: number,
  ): Promise<MediaUploadCompleteResponse> {
    this.validateImageMeta(dto.mimeType, dto.sizeBytes, maxBytes);
    await this.storage.verifyUploadedObject({
      storageKey: dto.storageKey,
      contentType: dto.mimeType,
      maxBytes,
      validateContentType: isImageUploadMimeType,
    });
    const displayUrl = await this.storage.createPresignedReadUrl(dto.storageKey);
    return { storageKey: dto.storageKey, displayUrl };
  }

  private async validateImageSession(
    dto: MediaUploadSessionRequest,
    maxBytes: number,
  ): Promise<void> {
    this.validateImageMeta(dto.mimeType, dto.sizeBytes, maxBytes);
  }

  private validateImageMeta(
    mimeType: string,
    sizeBytes: number,
    maxBytes: number,
  ): ImageUploadMimeType {
    if (!isImageUploadMimeType(mimeType)) {
      throw new BadRequestException({
        message: tournamentPosterTypeError(),
        error: 'FILE_TYPE',
      });
    }
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes) {
      const maxMb = Math.ceil(maxBytes / (1024 * 1024));
      throw new BadRequestException({
        message:
          maxBytes === TOURNAMENT_POSTER_MAX_BYTES
            ? tournamentPosterSizeError()
            : profilePhotoSizeError(maxMb),
        error: 'FILE_SIZE',
      });
    }
    return mimeType;
  }

  private assertProfilePhotoKey(userId: string, storageKey: string): void {
    this.assertUserScopedKey(userId, storageKey, 'profile-photos/');
  }

  private assertUserScopedKey(userId: string, storageKey: string, prefix: string): void {
    const expectedPrefix = `${prefix}${userId}/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      throw new BadRequestException({
        message: 'Invalid storage key for this upload',
        error: 'INVALID_STORAGE_KEY',
      });
    }
  }
}

/** Hard ceiling for legacy multipart interceptors (removed after presigned migration). */
export const PROFILE_PHOTO_UPLOAD_INTERCEPTOR_MAX_BYTES = 50 * 1024 * 1024;

export function isJpegBuffer(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer.subarray(0, 3).compare(JPEG_MAGIC) === 0;
}
