-- Persistent password-reset OTP send log for Admin analytics (no retroactive history).
CREATE TABLE "PasswordResetOtpSend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOtpSend_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordResetOtpSend_createdAt_idx" ON "PasswordResetOtpSend"("createdAt");

CREATE INDEX "PasswordResetOtpSend_userId_createdAt_idx" ON "PasswordResetOtpSend"("userId", "createdAt");

ALTER TABLE "PasswordResetOtpSend" ADD CONSTRAINT "PasswordResetOtpSend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
