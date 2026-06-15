-- §20: per-player fee amounts and registration link on Fee records.

ALTER TABLE "Tournament" ADD COLUMN "defaultPlayerFeeCents" BIGINT;

ALTER TABLE "Registration" ADD COLUMN "feeAmountCents" BIGINT;

ALTER TABLE "Fee" ADD COLUMN "registrationId" TEXT;

CREATE INDEX "Fee_registrationId_idx" ON "Fee"("registrationId");

ALTER TABLE "Fee" ADD CONSTRAINT "Fee_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
