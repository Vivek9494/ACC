import {
  AuthErrorCode,
  INVALID_POSTAL_CODE_MESSAGE,
  MIN_SIGNUP_AGE,
  MOBILE_NUMBER_EXISTS_MESSAGE,
  OTP_LENGTH,
  OTP_MAX_FAILED_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_DAY,
  OTP_TTL_SECONDS,
  isValidCanadianPostalCode,
  normalizeCanadianPostalCode,
  type ProfileDetail,
  profileMobileForStorage,
  SIGNUP_VALIDATION_MESSAGES,
} from '@acc/types';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Center, JerseySize, Province, User } from '@prisma/client';
import { randomInt } from 'node:crypto';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SMS_SENDER, type SmsSender } from '../sms/sms-sender';
import { MediaService } from '../media/media.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import {
  profileMobileOtpCodeKey,
  profileMobileOtpFailedKey,
  profileMobileOtpPendingKey,
  profileMobileOtpRequestKey,
} from './profile.constants';

const ONE_DAY_SECONDS = 24 * 60 * 60;

type UserWithCenter = User & {
  center: Center & { province: Province };
};

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  async getProfile(userId: string): Promise<ProfileDetail> {
    const user = await this.loadUser(userId);
    return this.toProfileDetail(user);
  }

  async requestMobileChangeOtp(userId: string, newMobileNumber: string): Promise<void> {
    const normalized = profileMobileForStorage(newMobileNumber);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.mobileNumber === normalized) {
      throw new BadRequestException({
        message: 'New mobile number matches your current number',
      });
    }

    const taken = await this.prisma.user.findUnique({
      where: { mobileNumber: normalized },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException({
        message: MOBILE_NUMBER_EXISTS_MESSAGE,
        error: AuthErrorCode.MobileNumberExists,
      });
    }

    const requestCount = await this.redis.incrementWithTtl(
      profileMobileOtpRequestKey(userId),
      ONE_DAY_SECONDS,
    );
    if (requestCount > OTP_MAX_REQUESTS_PER_DAY) {
      throw new HttpException(
        {
          message: 'Too many OTP requests. Please try again tomorrow.',
          error: AuthErrorCode.OtpRequestLimit,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateOtp();
    await this.redis.setWithTtl(profileMobileOtpPendingKey(userId), normalized, OTP_TTL_SECONDS);
    await this.redis.setWithTtl(profileMobileOtpCodeKey(userId), otp, OTP_TTL_SECONDS);
    await this.sms.sendSms(
      normalized,
      `Your ACC profile verification code is ${otp}. It expires in 5 minutes.`,
    );
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileDetail> {
    const user = await this.loadUser(userId);

    const center = await this.prisma.center.findUnique({
      where: { id: dto.centerId },
      select: { id: true, name: true, isActive: true, provinceId: true },
    });
    if (!center || !center.isActive) {
      throw new BadRequestException({
        message: 'Invalid or inactive center',
        error: AuthErrorCode.InvalidCenter,
      });
    }
    if (center.provinceId !== dto.provinceId) {
      throw new BadRequestException({
        message: SIGNUP_VALIDATION_MESSAGES.center.required,
        error: AuthErrorCode.InvalidCenter,
      });
    }

    const dob = new Date(dto.dateOfBirth);
    if (this.ageInYears(dob, new Date()) < MIN_SIGNUP_AGE) {
      throw new BadRequestException({
        message: SIGNUP_VALIDATION_MESSAGES.dateOfBirth.underage,
        error: AuthErrorCode.Underage,
      });
    }

    const address = dto.address?.trim() || null;
    const postalCodeRaw = dto.postalCode?.trim() ?? '';
    let postalCode: string | null = user.postalCode;
    if (postalCodeRaw) {
      if (!isValidCanadianPostalCode(postalCodeRaw)) {
        throw new BadRequestException({
          message: INVALID_POSTAL_CODE_MESSAGE,
          error: 'INVALID_POSTAL_CODE',
        });
      }
      postalCode = normalizeCanadianPostalCode(postalCodeRaw);
    } else if (dto.postalCode !== undefined) {
      postalCode = null;
    }

    const emergencyContactNumber = profileMobileForStorage(dto.emergencyContactNumber);
    const centerChanging = dto.centerId !== user.centerId;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        centerId: dto.centerId,
        email: dto.email?.trim() || '',
        dateOfBirth: dob,
        address,
        postalCode,
        profilePhotoUrl:
          dto.profilePhotoUrl !== undefined ? dto.profilePhotoUrl : user.profilePhotoUrl,
        emergencyContactName: dto.emergencyContactName.trim(),
        emergencyContactNumber,
        hasHealthCard: dto.hasHealthCard,
        jerseyName: dto.jerseyName?.trim() || null,
        jerseySize: (dto.jerseySize as JerseySize | undefined) ?? null,
        jerseyNumber: dto.jerseyNumber ?? user.jerseyNumber,
      },
      include: {
        center: { include: { province: true } },
      },
    });

    if (centerChanging) {
      await this.audit.record({
        action: 'USER_CENTER_CHANGED',
        actorUserId: userId,
        targetUserId: userId,
        targetEntityType: 'User',
        targetEntityId: userId,
        before: { centerId: user.centerId, centerName: user.center.name },
        after: { centerId: updated.centerId, centerName: updated.center.name },
      });
    }

    return this.toProfileDetail(updated);
  }

  async uploadProfilePhoto(userId: string, buffer: Buffer): Promise<string> {
    return this.media.uploadProfilePhoto(userId, buffer);
  }

  private async loadUser(userId: string): Promise<UserWithCenter> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { center: { include: { province: true } } },
    });
  }

  private toProfileDetail(user: UserWithCenter): ProfileDetail {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      mobileNumber: user.mobileNumber,
      email: user.email,
      dateOfBirth: user.dateOfBirth.toISOString().slice(0, 10),
      address: user.address,
      postalCode: user.postalCode,
      centerId: user.centerId,
      centerName: user.center.name,
      provinceId: user.center.provinceId,
      provinceName: user.center.province.name,
      profilePhotoUrl: user.profilePhotoUrl,
      emergencyContactName: user.emergencyContactName,
      emergencyContactNumber: user.emergencyContactNumber,
      hasHealthCard: user.hasHealthCard,
      jerseyName: user.jerseyName,
      jerseySize: user.jerseySize,
      jerseyNumber: user.jerseyNumber,
    };
  }

  private generateOtp(): string {
    const max = 10 ** OTP_LENGTH;
    return randomInt(0, max).toString().padStart(OTP_LENGTH, '0');
  }

  private ageInYears(dob: Date, now: Date): number {
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) {
      age -= 1;
    }
    return age;
  }
}
