import 'reflect-metadata';

import {
  type AuthUser,
  BallType,
  Permission,
  PlayerSkillVideoStatus,
  RegistrationStatus,
  UserRole,
} from '@acc/types';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { PermissionService } from '../authz/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppSettingsService } from '../settings/app-settings.service';
import { VIDEO_STORAGE_PROVIDER } from '../video-storage/video-storage.provider';
import { PlayerSkillVideosService } from './player-skill-videos.service';

const player: AuthUser = {
  id: 'player-1',
  firstName: 'Arjun',
  lastName: 'Mehta',
  mobileNumber: '+15555550001',
  email: 'arjun@acc.local',
  centerId: 'center-A',
  jerseyNumber: 7,
  profilePhotoUrl: null,
  role: UserRole.Player,
  isActive: true,
  teamLeadAssignments: [],
};

const captain: AuthUser = {
  ...player,
  id: 'captain-1',
  role: UserRole.Captain,
  teamLeadAssignments: [{ role: UserRole.Captain, tournamentId: 'tour-1', teamId: 'team-1' }],
};

describe('PlayerSkillVideosService', () => {
  let service: PlayerSkillVideosService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    registration: { findUnique: jest.Mock; count: jest.Mock };
    playerSkillVideo: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let permissions: { check: jest.Mock };
  let storage: {
    getUploadTarget: jest.Mock;
    verifyUploadedObject: jest.Mock;
    getPlaybackUrl: jest.Mock;
    deleteObject: jest.Mock;
  };
  let settings: {
    getVideoUploadMaxBytes: jest.Mock;
    getUploadLimits: jest.Mock;
  };

  const closedTournament = {
    id: 'tour-1',
    ballType: BallType.Tennis,
    isDeleted: false,
    registrationOpenAt: new Date('2026-01-01T00:00:00.000Z'),
    registrationCloseAt: new Date('2026-02-01T00:00:00.000Z'),
    videoRequired: true,
    videoUploadEndDate: new Date('2099-03-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      tournament: { findUnique: jest.fn().mockResolvedValue(closedTournament) },
      registration: {
        findUnique: jest.fn().mockResolvedValue({ status: RegistrationStatus.Confirmed }),
        count: jest.fn().mockResolvedValue(0),
      },
      playerSkillVideo: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'vid-1',
          tournamentId: 'tour-1',
          userId: 'player-1',
          url: 'https://storage.example/skill-videos/tour-1/player-1/file.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 1024,
          status: PlayerSkillVideoStatus.Ready,
          uploadedAt: new Date('2026-02-15T00:00:00.000Z'),
        }),
      },
    };
    permissions = {
      check: jest.fn().mockResolvedValue(true),
    };
    storage = {
      getUploadTarget: jest.fn().mockResolvedValue({
        uploadMethod: 'PUT',
        uploadUrl: 'https://storage.example/upload',
        storageKey: 'skill-videos/tour-1/player-1/file.mp4',
        playbackUrl: 'https://storage.example/skill-videos/tour-1/player-1/file.mp4',
        headers: { 'Content-Type': 'video/mp4' },
      }),
      verifyUploadedObject: jest.fn().mockResolvedValue(undefined),
      getPlaybackUrl: jest
        .fn()
        .mockReturnValue('https://storage.example/skill-videos/tour-1/player-1/file.mp4'),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    settings = {
      getVideoUploadMaxBytes: jest.fn().mockResolvedValue(100 * 1024 * 1024),
      getUploadLimits: jest.fn().mockResolvedValue({ videoUploadMaxMb: 100, imageUploadMaxMb: 5 }),
    };

    service = new PlayerSkillVideosService(
      prisma as unknown as PrismaService,
      permissions as unknown as PermissionService,
      settings as unknown as AppSettingsService,
      storage,
    );
  });

  it('creates a presigned upload session for a verified tennis player', async () => {
    const session = await service.createUploadSession(player, 'tour-1', {
      mimeType: 'video/mp4',
      sizeBytes: 1024,
    });

    expect(session.uploadMethod).toBe('PUT');
    expect(session.storageKey).toContain('skill-videos/tour-1/player-1');
    expect(storage.getUploadTarget).toHaveBeenCalled();
    expect(permissions.check).toHaveBeenCalledWith(Permission.UPLOAD_OWN_VIDEO, player, {
      tournamentId: 'tour-1',
      targetUserId: 'player-1',
    });
  });

  it('rejects upload when registration is not confirmed', async () => {
    prisma.registration.findUnique.mockResolvedValue({ status: RegistrationStatus.InWaitlist });

    await expect(
      service.createUploadSession(player, 'tour-1', { mimeType: 'video/mp4', sizeBytes: 1024 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects upload when video is not required for the tournament', async () => {
    prisma.tournament.findUnique.mockResolvedValue({ ...closedTournament, videoRequired: false });

    await expect(
      service.createUploadSession(player, 'tour-1', { mimeType: 'video/mp4', sizeBytes: 1024 }),
    ).rejects.toMatchObject({
      response: { error: 'VIDEO_NOT_REQUIRED' },
    });
  });

  it('rejects upload when video exceeds configured max size', async () => {
    settings.getVideoUploadMaxBytes.mockResolvedValue(10 * 1024 * 1024);
    settings.getUploadLimits.mockResolvedValue({ videoUploadMaxMb: 10, imageUploadMaxMb: 5 });

    await expect(
      service.createUploadSession(player, 'tour-1', {
        mimeType: 'video/mp4',
        sizeBytes: 11 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects storage keys for another player', async () => {
    await expect(
      service.completeUpload(player, 'tour-1', {
        storageKey: 'skill-videos/tour-1/other-player/file.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 1024,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('completes upload, deletes prior object, and upserts metadata', async () => {
    prisma.playerSkillVideo.findUnique.mockResolvedValue({
      storageKey: 'skill-videos/tour-1/player-1/old.mp4',
    });

    const summary = await service.completeUpload(player, 'tour-1', {
      storageKey: 'skill-videos/tour-1/player-1/file.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 1024,
    });

    expect(storage.deleteObject).toHaveBeenCalledWith('skill-videos/tour-1/player-1/old.mp4');
    expect(summary.playbackUrl).toContain('skill-videos');
    expect(summary.status).toBe(PlayerSkillVideoStatus.Ready);
    expect(prisma.playerSkillVideo.upsert).toHaveBeenCalled();
  });

  it('returns a scouting playback URL for Captain / VC / Club Manager', async () => {
    prisma.playerSkillVideo.findUnique.mockResolvedValue({
      id: 'vid-1',
      storageKey: 'skill-videos/tour-1/player-1/file.mp4',
      mimeType: 'video/mp4',
      status: PlayerSkillVideoStatus.Ready,
    });

    const playback = await service.getScoutingPlayback(captain, 'tour-1', 'player-1');

    expect(playback.playbackUrl).toContain('skill-videos');
    expect(playback.skillVideoId).toBe('vid-1');
    expect(storage.getPlaybackUrl).toHaveBeenCalledWith('skill-videos/tour-1/player-1/file.mp4');
    expect(permissions.check).toHaveBeenCalledWith(
      Permission.VIEW_VERIFIED_REGISTERED_PLAYERS,
      captain,
      { tournamentId: 'tour-1' },
    );
  });

  it('forbids scouting playback for users without list access', async () => {
    permissions.check.mockResolvedValue(false);

    await expect(service.getScoutingPlayback(captain, 'tour-1', 'player-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns not found when the player has no ready skill video', async () => {
    prisma.playerSkillVideo.findUnique.mockResolvedValue(null);

    await expect(service.getScoutingPlayback(captain, 'tour-1', 'player-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
