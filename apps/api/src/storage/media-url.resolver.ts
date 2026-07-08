import { Injectable } from '@nestjs/common';

import { S3StorageService } from './s3-storage.service';

@Injectable()
export class MediaUrlResolver {
  constructor(private readonly storage: S3StorageService) {}

  resolveReadUrl(stored: string | null | undefined): Promise<string | null> {
    if (stored == null || stored.trim().length === 0) {
      return Promise.resolve(null);
    }
    return this.storage.createPresignedReadUrl(stored.trim());
  }

  async resolveReadUrls(stored: (string | null | undefined)[]): Promise<(string | null)[]> {
    return Promise.all(stored.map((value) => this.resolveReadUrl(value)));
  }

  async resolveField<T extends Record<string, unknown>, K extends keyof T>(
    row: T,
    field: K,
  ): Promise<T> {
    const value = row[field];
    if (typeof value !== 'string' && value != null) {
      return row;
    }
    const resolved = await this.resolveReadUrl(value as string | null | undefined);
    return { ...row, [field]: resolved };
  }

  async resolveFields<T extends Record<string, unknown>, K extends keyof T>(
    rows: T[],
    field: K,
  ): Promise<T[]> {
    const resolved = await this.resolveReadUrls(
      rows.map((row) => row[field] as string | null | undefined),
    );
    return rows.map((row, index) => ({ ...row, [field]: resolved[index] ?? null }));
  }

  async resolveProfilePhotoUrls<T extends { profilePhotoUrl: string | null }>(
    rows: T[],
  ): Promise<T[]> {
    if (rows.length === 0) {
      return [];
    }
    const urls = await this.resolveReadUrls(rows.map((row) => row.profilePhotoUrl));
    return rows.map((row, index) => ({ ...row, profilePhotoUrl: urls[index] ?? null }));
  }

  async resolveProfilePhoto<T extends { profilePhotoUrl: string | null }>(row: T): Promise<T> {
    const url = await this.resolveReadUrl(row.profilePhotoUrl);
    return { ...row, profilePhotoUrl: url };
  }
}
