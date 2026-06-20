import {
  buildPlayerSkillVideoStorageKey,
  canUploadPlayerSkillVideo,
  type AuthUser,
  isRegistrationVerificationComplete,
  Permission,
  PlayerSkillVideoStatus,
  RegistrationStatus,
  type PlayerSkillVideoCompleteUploadRequest,
  type PlayerSkillVideoPlaybackView,
  type PlayerSkillVideoSummary,
  type PlayerSkillVideoUploadSessionRequest,
  type PlayerSkillVideoUploadSessionResponse,
  tournamentHasRegistrationWindow,
  tournamentUsesRegistrationVerification,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PermissionService } from '../authz/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  VIDEO_STORAGE_PROVIDER,
  type VideoStorageProvider,
} from '../video-storage/video-storage.provider';

@Injectable()
export class PlayerSkillVideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    @Inject(VIDEO_STORAGE_PROVIDER) private readonly storage: VideoStorageProvider,
  ) {}

  async getMyVideo(actor: AuthUser, tournamentId: string): Promise<PlayerSkillVideoSummary | null> {
    await this.assertUploadEligible(actor, tournamentId);
    const row = await this.prisma.playerSkillVideo.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: actor.id } },
    });
    return row ? this.toSummary(row) : null;
  }

  /** Captain / VC / Club Manager scouting playback (same gate as verified player lists). */
  async getScoutingPlayback(
    actor: AuthUser,
    tournamentId: string,
    userId: string,
  ): Promise<PlayerSkillVideoPlaybackView> {
    await this.assertScoutingPlaybackEligible(actor, tournamentId);

    const row = await this.prisma.playerSkillVideo.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
    });
    if (!row || row.status !== PlayerSkillVideoStatus.Ready) {
      throw new NotFoundException({
        message: 'Skill video not available for this player',
        error: 'NOT_FOUND',
      });
    }

    return {
      skillVideoId: row.id,
      playbackUrl: this.storage.getPlaybackUrl(row.storageKey),
      mimeType: row.mimeType,
      status: row.status as PlayerSkillVideoPlaybackView['status'],
    };
  }

  async createUploadSession(
    actor: AuthUser,
    tournamentId: string,
    dto: PlayerSkillVideoUploadSessionRequest,
  ): Promise<PlayerSkillVideoUploadSessionResponse> {
    await this.assertUploadEligible(actor, tournamentId);

    const storageKey = buildPlayerSkillVideoStorageKey(tournamentId, actor.id, dto.mimeType);
    const target = await this.storage.getUploadTarget({
      storageKey,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });

    return {
      uploadMethod: target.uploadMethod,
      uploadUrl: target.uploadUrl,
      storageKey: target.storageKey,
      playbackUrl: target.playbackUrl,
      headers: target.headers,
    };
  }

  async completeUpload(
    actor: AuthUser,
    tournamentId: string,
    dto: PlayerSkillVideoCompleteUploadRequest,
  ): Promise<PlayerSkillVideoSummary> {
    await this.assertUploadEligible(actor, tournamentId);

    const expectedPrefix = `skill-videos/${tournamentId}/${actor.id}/`;
    if (!dto.storageKey.startsWith(expectedPrefix)) {
      throw new ForbiddenException({
        message: 'Invalid video storage key',
        error: 'FORBIDDEN',
      });
    }

    await this.storage.verifyUploadedObject({
      storageKey: dto.storageKey,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });

    const playbackUrl = this.storage.getPlaybackUrl(dto.storageKey);

    const existing = await this.prisma.playerSkillVideo.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: actor.id } },
    });
    if (existing?.storageKey && existing.storageKey !== dto.storageKey) {
      await this.storage.deleteObject(existing.storageKey);
    }

    const row = await this.prisma.playerSkillVideo.upsert({
      where: { tournamentId_userId: { tournamentId, userId: actor.id } },
      create: {
        tournamentId,
        userId: actor.id,
        url: playbackUrl,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        storageKey: dto.storageKey,
        status: PlayerSkillVideoStatus.Ready,
      },
      update: {
        url: playbackUrl,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        storageKey: dto.storageKey,
        status: PlayerSkillVideoStatus.Ready,
        uploadedAt: new Date(),
      },
    });

    return this.toSummary(row);
  }

  async viewerUploadFlags(
    viewer: AuthUser | null,
    tournament: {
      id: string;
      ballType: string;
      hasRegistrationWindow: boolean;
      registrationOpenAt: string | null;
      registrationCloseAt: string | null;
      registrationVerificationComplete: boolean;
      videoUploadEndDate: string | null;
    },
  ): Promise<{ canUploadSkillVideo: boolean; hasSkillVideo: boolean }> {
    if (!viewer) {
      return { canUploadSkillVideo: false, hasSkillVideo: false };
    }

    const registration = await this.prisma.registration.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: viewer.id } },
      select: { status: true },
    });

    const canUpload = canUploadPlayerSkillVideo(
      viewer,
      {
        id: tournament.id,
        ballType: tournament.ballType as never,
        registrationVerificationComplete: tournament.registrationVerificationComplete,
        videoUploadEndDate: tournament.videoUploadEndDate,
      },
      registration?.status ?? null,
    );

    if (!canUpload) {
      return { canUploadSkillVideo: false, hasSkillVideo: false };
    }

    const existing = await this.prisma.playerSkillVideo.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: viewer.id } },
      select: { id: true },
    });

    return { canUploadSkillVideo: true, hasSkillVideo: existing != null };
  }

  private async assertScoutingPlaybackEligible(
    actor: AuthUser,
    tournamentId: string,
  ): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        ballType: true,
        isDeleted: true,
        registrationOpenAt: true,
        registrationCloseAt: true,
      },
    });
    if (!tournament || tournament.isDeleted) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }

    if (!tournamentUsesRegistrationVerification(tournament.ballType as never)) {
      throw new BadRequestException({
        message: 'Skill videos are available for tennis tournaments only',
        error: 'VIDEO_TENNIS_ONLY',
      });
    }

    const hasRegistrationWindow = tournamentHasRegistrationWindow({
      registrationOpenAt: tournament.registrationOpenAt?.toISOString() ?? null,
      registrationCloseAt: tournament.registrationCloseAt?.toISOString() ?? null,
    });

    const pendingWaitlistCount = await this.prisma.registration.count({
      where: { tournamentId, status: RegistrationStatus.InWaitlist },
    });

    const verificationComplete = isRegistrationVerificationComplete(
      {
        ballType: tournament.ballType as never,
        hasRegistrationWindow,
        registrationOpenAt: tournament.registrationOpenAt?.toISOString() ?? null,
        registrationCloseAt: tournament.registrationCloseAt?.toISOString() ?? null,
      },
      pendingWaitlistCount,
    );

    if (!verificationComplete) {
      throw new BadRequestException({
        message: 'Skill videos are available after all players are verified',
        error: 'VIDEO_VERIFICATION_PENDING',
      });
    }

    const allowed = await this.permissions.check(
      Permission.VIEW_VERIFIED_REGISTERED_PLAYERS,
      actor,
      { tournamentId },
    );
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to view player skill videos',
        error: 'FORBIDDEN',
      });
    }
  }

  private async assertUploadEligible(actor: AuthUser, tournamentId: string): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        ballType: true,
        isDeleted: true,
        registrationOpenAt: true,
        registrationCloseAt: true,
        videoUploadEndDate: true,
      },
    });
    if (!tournament || tournament.isDeleted) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }

    if (!tournamentUsesRegistrationVerification(tournament.ballType as never)) {
      throw new BadRequestException({
        message: 'Skill video upload is available for tennis tournaments only',
        error: 'VIDEO_TENNIS_ONLY',
      });
    }

    const hasRegistrationWindow = tournamentHasRegistrationWindow({
      registrationOpenAt: tournament.registrationOpenAt?.toISOString() ?? null,
      registrationCloseAt: tournament.registrationCloseAt?.toISOString() ?? null,
    });

    const pendingWaitlistCount = await this.prisma.registration.count({
      where: { tournamentId, status: RegistrationStatus.InWaitlist },
    });

    const verificationComplete = isRegistrationVerificationComplete(
      {
        ballType: tournament.ballType as never,
        hasRegistrationWindow,
        registrationOpenAt: tournament.registrationOpenAt?.toISOString() ?? null,
        registrationCloseAt: tournament.registrationCloseAt?.toISOString() ?? null,
      },
      pendingWaitlistCount,
    );

    if (!verificationComplete) {
      throw new BadRequestException({
        message: 'Video upload opens after all players are verified',
        error: 'VIDEO_VERIFICATION_PENDING',
      });
    }

    const registration = await this.prisma.registration.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: actor.id } },
      select: { status: true },
    });
    if (registration?.status !== RegistrationStatus.Confirmed) {
      throw new ForbiddenException({
        message: 'Only verified players may upload a skill video',
        error: 'FORBIDDEN',
      });
    }

    if (tournament.videoUploadEndDate) {
      const deadline = new Date(tournament.videoUploadEndDate);
      deadline.setUTCHours(23, 59, 59, 999);
      if (new Date() > deadline) {
        throw new BadRequestException({
          message: 'The video upload window has closed',
          error: 'VIDEO_WINDOW_CLOSED',
        });
      }
    }

    const allowed = await this.permissions.check(Permission.UPLOAD_OWN_VIDEO, actor, {
      tournamentId,
      targetUserId: actor.id,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to upload a video',
        error: 'FORBIDDEN',
      });
    }
  }

  private toSummary(row: {
    id: string;
    tournamentId: string;
    userId: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    status: string;
    uploadedAt: Date;
  }): PlayerSkillVideoSummary {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      userId: row.userId,
      playbackUrl: row.url,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      status: row.status as PlayerSkillVideoSummary['status'],
      uploadedAt: row.uploadedAt.toISOString(),
    };
  }
}
