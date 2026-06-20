-- Rename showcase video table to player skill video and add lifecycle status.
ALTER TABLE "PlayerVideo" RENAME TO "PlayerSkillVideo";

CREATE TYPE "PlayerSkillVideoStatus" AS ENUM ('READY');

ALTER TABLE "PlayerSkillVideo"
  ADD COLUMN "status" "PlayerSkillVideoStatus" NOT NULL DEFAULT 'READY';
