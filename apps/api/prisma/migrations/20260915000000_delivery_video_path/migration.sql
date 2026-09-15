-- Auto boundary clips: nullable video path on Delivery (local OBS path now; S3 URL later).
ALTER TABLE "Delivery" ADD COLUMN "videoPath" TEXT;
