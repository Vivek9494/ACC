-- v0 boundary auto-highlights: mark 4/6 deliveries for a future clip worker.
-- Additive nullable columns alongside shot placement (per-ball analysis).
ALTER TABLE "Delivery" ADD COLUMN "highlightMarkedAt" TIMESTAMP(3);
ALTER TABLE "Delivery" ADD COLUMN "highlightBoundaryRuns" INTEGER;

CREATE INDEX "Delivery_inningsId_highlightMarkedAt_idx"
  ON "Delivery"("inningsId", "highlightMarkedAt");
