-- Admin temporary password flow: forced change on next login with expiry.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "tempPasswordExpiresAt" TIMESTAMP(3);
