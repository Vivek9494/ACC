-- Per-ball shot placement (normalized ground coordinates). Optional display metadata;
-- does not affect scoring fold.
ALTER TABLE "Delivery" ADD COLUMN "shotX" DOUBLE PRECISION;
ALTER TABLE "Delivery" ADD COLUMN "shotY" DOUBLE PRECISION;
