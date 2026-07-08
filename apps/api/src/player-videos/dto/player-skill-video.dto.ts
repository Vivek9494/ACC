import { IsIn, IsInt, IsString, Min } from 'class-validator';
import {
  PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES,
  type PlayerSkillVideoCompleteUploadRequest,
  type PlayerSkillVideoUploadSessionRequest,
} from '@acc/types';

export class PlayerSkillVideoUploadSessionDto implements PlayerSkillVideoUploadSessionRequest {
  @IsIn(PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES)
  mimeType!: (typeof PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES)[number];

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class PlayerSkillVideoCompleteUploadDto implements PlayerSkillVideoCompleteUploadRequest {
  @IsString()
  storageKey!: string;

  @IsIn(PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES)
  mimeType!: (typeof PLAYER_SKILL_VIDEO_ACCEPTED_MIME_TYPES)[number];

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
