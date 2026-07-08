import {
  AppSettingKey,
  DEFAULT_IMAGE_UPLOAD_MAX_MB,
  DEFAULT_VIDEO_UPLOAD_MAX_MB,
  isMaskedAwsKeyValue,
  isValidAwsSecretAccessKey,
  maskAwsSecretAccessKey,
  normalizeAwsSecretAccessKey,
  normalizeGoogleMapsApiKey,
  type AdminAppSettings,
  type AuthUser,
  type UpdateAdminAppSettingsRequest,
  type UploadLimits,
  isValidGoogleMapsApiKey,
  isValidImageUploadMaxMb,
  isValidVideoUploadMaxMb,
  mbToBytes,
} from '@acc/types';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppSettingsService {
  private uploadLimitsCache: UploadLimits | null = null;
  private googleMapsApiKeyDbCache: string | null | undefined;
  private awsSecretAccessKeyDbCache: string | null | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async getUploadLimits(): Promise<UploadLimits> {
    if (this.uploadLimitsCache) {
      return this.uploadLimitsCache;
    }
    const rows = await this.prisma.appSetting.findMany({
      where: {
        key: {
          in: [AppSettingKey.VideoUploadMaxMb, AppSettingKey.ImageUploadMaxMb],
        },
      },
    });
    const limits: UploadLimits = {
      videoUploadMaxMb: DEFAULT_VIDEO_UPLOAD_MAX_MB,
      imageUploadMaxMb: DEFAULT_IMAGE_UPLOAD_MAX_MB,
    };
    for (const row of rows) {
      const value = this.readMb(row.valueJson);
      if (row.key === AppSettingKey.VideoUploadMaxMb && value != null) {
        limits.videoUploadMaxMb = value;
      }
      if (row.key === AppSettingKey.ImageUploadMaxMb && value != null) {
        limits.imageUploadMaxMb = value;
      }
    }
    this.uploadLimitsCache = limits;
    return limits;
  }

  async getVideoUploadMaxBytes(): Promise<number> {
    const limits = await this.getUploadLimits();
    return mbToBytes(limits.videoUploadMaxMb);
  }

  async getImageUploadMaxBytes(): Promise<number> {
    const limits = await this.getUploadLimits();
    return mbToBytes(limits.imageUploadMaxMb);
  }

  /** Server-side Google Places / Geocoding key — database first, then env fallback. */
  async getGoogleMapsApiKey(): Promise<string | null> {
    const fromDb = await this.getGoogleMapsApiKeyFromDb();
    if (fromDb) {
      return fromDb;
    }
    return this.getGoogleMapsApiKeyFromEnv();
  }

  /** Server-side S3 secret access key — database first, then env fallback. Never expose to clients. */
  async getAwsSecretAccessKey(): Promise<string | null> {
    const fromDb = await this.getAwsSecretAccessKeyFromDb();
    if (fromDb) {
      return fromDb;
    }
    return this.getAwsSecretAccessKeyFromEnv();
  }

  async getAdminSettings(): Promise<AdminAppSettings> {
    const limits = await this.getUploadLimits();
    const googleMapsApiKey = (await this.getGoogleMapsApiKey()) ?? '';
    const effectiveAwsKey = await this.getAwsSecretAccessKey();
    return {
      ...limits,
      googleMapsApiKey,
      awsKeyConfigured: effectiveAwsKey != null && effectiveAwsKey.length > 0,
      awsKeyMasked: effectiveAwsKey ? maskAwsSecretAccessKey(effectiveAwsKey) : null,
    };
  }

  async updateAdminSettings(
    actor: AuthUser,
    dto: UpdateAdminAppSettingsRequest,
  ): Promise<AdminAppSettings> {
    if (!isValidVideoUploadMaxMb(dto.videoUploadMaxMb)) {
      throw new BadRequestException({
        message: 'Invalid video upload size',
        error: 'INVALID_VIDEO_UPLOAD_MAX_MB',
        fields: { videoUploadMaxMb: 'Invalid value' },
      });
    }
    if (!isValidImageUploadMaxMb(dto.imageUploadMaxMb)) {
      throw new BadRequestException({
        message: 'Invalid image upload size',
        error: 'INVALID_IMAGE_UPLOAD_MAX_MB',
        fields: { imageUploadMaxMb: 'Invalid value' },
      });
    }
    const googleMapsApiKey = normalizeGoogleMapsApiKey(dto.googleMapsApiKey);
    if (!isValidGoogleMapsApiKey(googleMapsApiKey)) {
      throw new BadRequestException({
        message: 'Google Maps API key is required',
        error: 'INVALID_GOOGLE_MAPS_API_KEY',
        fields: { googleMapsApiKey: 'Required' },
      });
    }

    const incomingAwsKey = dto.awsKey?.trim() ?? '';
    const keepExistingAwsKey =
      incomingAwsKey.length === 0 || isMaskedAwsKeyValue(incomingAwsKey);
    let awsSecretAccessKeyToStore: string | null = null;
    if (!keepExistingAwsKey) {
      awsSecretAccessKeyToStore = normalizeAwsSecretAccessKey(incomingAwsKey);
      if (!isValidAwsSecretAccessKey(awsSecretAccessKeyToStore)) {
        throw new BadRequestException({
          message: 'Invalid AWS secret access key',
          error: 'INVALID_AWS_SECRET_ACCESS_KEY',
          fields: { awsKey: 'Invalid value' },
        });
      }
    }

    const beforeLimits = await this.getUploadLimits();
    const effectiveKeyBefore = await this.getGoogleMapsApiKey();
    const effectiveAwsKeyBefore = await this.getAwsSecretAccessKey();

    const writes = [
      this.prisma.appSetting.upsert({
        where: { key: AppSettingKey.VideoUploadMaxMb },
        create: {
          key: AppSettingKey.VideoUploadMaxMb,
          valueJson: dto.videoUploadMaxMb,
        },
        update: { valueJson: dto.videoUploadMaxMb },
      }),
      this.prisma.appSetting.upsert({
        where: { key: AppSettingKey.ImageUploadMaxMb },
        create: {
          key: AppSettingKey.ImageUploadMaxMb,
          valueJson: dto.imageUploadMaxMb,
        },
        update: { valueJson: dto.imageUploadMaxMb },
      }),
      this.prisma.appSetting.upsert({
        where: { key: AppSettingKey.GoogleMapsApiKey },
        create: {
          key: AppSettingKey.GoogleMapsApiKey,
          valueJson: googleMapsApiKey,
        },
        update: { valueJson: googleMapsApiKey },
      }),
    ];

    if (awsSecretAccessKeyToStore != null) {
      writes.push(
        this.prisma.appSetting.upsert({
          where: { key: AppSettingKey.AwsSecretAccessKey },
          create: {
            key: AppSettingKey.AwsSecretAccessKey,
            valueJson: awsSecretAccessKeyToStore,
          },
          update: { valueJson: awsSecretAccessKeyToStore },
        }),
      );
    }

    await this.prisma.$transaction(writes);

    this.invalidateCache();
    const after = await this.getAdminSettings();
    const googleMapsApiKeyUpdated = effectiveKeyBefore !== googleMapsApiKey;
    const awsSecretAccessKeyUpdated =
      awsSecretAccessKeyToStore != null && effectiveAwsKeyBefore !== awsSecretAccessKeyToStore;

    await this.audit.record({
      action: 'APP_SETTINGS_UPDATED',
      actorUserId: actor.id,
      targetEntityType: 'app_settings',
      targetEntityId: 'admin_settings',
      before: {
        videoUploadMaxMb: beforeLimits.videoUploadMaxMb,
        imageUploadMaxMb: beforeLimits.imageUploadMaxMb,
        googleMapsApiKeyConfigured: effectiveKeyBefore != null && effectiveKeyBefore.length > 0,
        awsKeyConfigured: effectiveAwsKeyBefore != null && effectiveAwsKeyBefore.length > 0,
      },
      after: {
        videoUploadMaxMb: after.videoUploadMaxMb,
        imageUploadMaxMb: after.imageUploadMaxMb,
        googleMapsApiKeyConfigured: true,
        awsKeyConfigured: after.awsKeyConfigured,
        ...(googleMapsApiKeyUpdated ? { googleMapsApiKeyUpdated: true } : {}),
        ...(awsSecretAccessKeyUpdated ? { awsKeyUpdated: true } : {}),
      },
    });

    return after;
  }

  private invalidateCache(): void {
    this.uploadLimitsCache = null;
    this.googleMapsApiKeyDbCache = undefined;
    this.awsSecretAccessKeyDbCache = undefined;
  }

  private async getGoogleMapsApiKeyFromDb(): Promise<string | null> {
    if (this.googleMapsApiKeyDbCache !== undefined) {
      return this.googleMapsApiKeyDbCache;
    }
    const row = await this.prisma.appSetting.findUnique({
      where: { key: AppSettingKey.GoogleMapsApiKey },
    });
    const key = this.readString(row?.valueJson);
    this.googleMapsApiKeyDbCache = key;
    return key;
  }

  private getGoogleMapsApiKeyFromEnv(): string | null {
    const raw = this.config.get<string>('GOOGLE_PLACES_KEY');
    if (!raw) {
      return null;
    }
    const key = normalizeGoogleMapsApiKey(raw);
    return key.length > 0 ? key : null;
  }

  private async getAwsSecretAccessKeyFromDb(): Promise<string | null> {
    if (this.awsSecretAccessKeyDbCache !== undefined) {
      return this.awsSecretAccessKeyDbCache;
    }
    const row = await this.prisma.appSetting.findUnique({
      where: { key: AppSettingKey.AwsSecretAccessKey },
    });
    const key = this.readAwsSecretAccessKey(row?.valueJson);
    this.awsSecretAccessKeyDbCache = key;
    return key;
  }

  private getAwsSecretAccessKeyFromEnv(): string | null {
    const raw = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    if (!raw) {
      return null;
    }
    const key = normalizeAwsSecretAccessKey(raw);
    return key.length > 0 ? key : null;
  }

  private readMb(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }
    return null;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const key = normalizeGoogleMapsApiKey(value);
    return key.length > 0 ? key : null;
  }

  private readAwsSecretAccessKey(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const key = normalizeAwsSecretAccessKey(value);
    return key.length > 0 ? key : null;
  }
}
