import {
  SIGNUP_PROFILE_PHOTO_MAX_BYTES,
  TOURNAMENT_POSTER_MAX_BYTES,
  tournamentPosterSizeError,
  tournamentPosterTypeError,
} from '@acc/types';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string | undefined;
  private readonly region: string;
  private readonly publicApiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET');
    this.region = this.config.get<string>('AWS_REGION') ?? 'ca-central-1';
    this.publicApiUrl = this.config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3001';
    this.s3 = this.bucket
      ? new S3Client({
          region: this.region,
          credentials:
            this.config.get<string>('AWS_ACCESS_KEY_ID') &&
            this.config.get<string>('AWS_SECRET_ACCESS_KEY')
              ? {
                  accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') as string,
                  secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') as string,
                }
              : undefined,
        })
      : null;
  }

  validateProfilePhotoBuffer(buffer: Buffer): void {
    if (buffer.length === 0 || buffer.length > SIGNUP_PROFILE_PHOTO_MAX_BYTES) {
      throw new BadRequestException({
        message: 'Profile photo must be JPG and no larger than 5MB',
      });
    }
    if (buffer.subarray(0, 3).compare(JPEG_MAGIC) !== 0) {
      throw new BadRequestException({
        message: 'Profile photo must be JPG or JPEG',
      });
    }
  }

  async uploadProfilePhoto(userId: string, buffer: Buffer): Promise<string> {
    this.validateProfilePhotoBuffer(buffer);

    if (this.s3 && this.bucket) {
      const key = `profiles/${userId}/${Date.now()}.jpg`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: 'image/jpeg',
        }),
      );
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }

    const dir = join(process.cwd(), 'uploads', 'profiles');
    await mkdir(dir, { recursive: true });
    const filename = `${userId}.jpg`;
    await writeFile(join(dir, filename), buffer);
    const url = `${this.publicApiUrl}/uploads/profiles/${filename}`;
    this.logger.log(`Stored profile photo locally for ${userId} (S3 not configured)`);
    return url;
  }

  validateTournamentPosterBuffer(buffer: Buffer): 'image/jpeg' {
    if (buffer.length === 0 || buffer.length > TOURNAMENT_POSTER_MAX_BYTES) {
      throw new BadRequestException({
        message: tournamentPosterSizeError(),
        error: 'POSTER_SIZE',
        fields: { poster: tournamentPosterSizeError() },
      });
    }
    if (buffer.subarray(0, 3).compare(JPEG_MAGIC) === 0) {
      return 'image/jpeg';
    }
    throw new BadRequestException({
      message: tournamentPosterTypeError(),
      error: 'POSTER_TYPE',
      fields: { poster: tournamentPosterTypeError() },
    });
  }

  async uploadTournamentPoster(userId: string, buffer: Buffer): Promise<string> {
    const contentType = this.validateTournamentPosterBuffer(buffer);
    const ext = 'jpg';

    if (this.s3 && this.bucket) {
      const key = `posters/${userId}/${Date.now()}.${ext}`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }

    const dir = join(process.cwd(), 'uploads', 'posters');
    await mkdir(dir, { recursive: true });
    const filename = `${userId}-${Date.now()}.${ext}`;
    await writeFile(join(dir, filename), buffer);
    const url = `${this.publicApiUrl}/uploads/posters/${filename}`;
    this.logger.log(`Stored tournament poster locally (S3 not configured)`);
    return url;
  }

  validateTeamLogoBuffer(buffer: Buffer): 'image/jpeg' {
    return this.validateTournamentPosterBuffer(buffer);
  }

  async uploadTeamLogo(userId: string, buffer: Buffer): Promise<string> {
    const contentType = this.validateTeamLogoBuffer(buffer);
    const ext = 'jpg';

    if (this.s3 && this.bucket) {
      const key = `team-logos/${userId}/${Date.now()}.${ext}`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }

    const dir = join(process.cwd(), 'uploads', 'team-logos');
    await mkdir(dir, { recursive: true });
    const filename = `${userId}-${Date.now()}.${ext}`;
    await writeFile(join(dir, filename), buffer);
    const url = `${this.publicApiUrl}/uploads/team-logos/${filename}`;
    this.logger.log(`Stored team logo locally (S3 not configured)`);
    return url;
  }
}
