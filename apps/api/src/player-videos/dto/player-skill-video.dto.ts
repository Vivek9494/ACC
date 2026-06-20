import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import {
  PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES,
  PLAYER_SKILL_VIDEO_MAX_BYTES,
  type PlayerSkillVideoCompleteUploadRequest,
  type PlayerSkillVideoUploadSessionRequest,
} from '@acc/types';

export class PlayerSkillVideoUploadSessionDto implements PlayerSkillVideoUploadSessionRequest {
  @IsIn(PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES)
  mimeType!: (typeof PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES)[number];

  @IsInt()
  @Min(1)
  @Max(PLAYER_SKILL_VIDEO_MAX_BYTES)
  sizeBytes!: number;
}

export class PlayerSkillVideoCompleteUploadDto implements PlayerSkillVideoCompleteUploadRequest {
  @IsString()
  storageKey!: string;

  @IsIn(PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES)
  mimeType!: (typeof PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES)[number];

  @IsInt()
  @Min(1)
  @Max(PLAYER_SKILL_VIDEO_MAX_BYTES)
  sizeBytes!: number;
}
