-- Short runs: physical crossings may exceed credited runs (Laws short run).
ALTER TABLE "Delivery" ADD COLUMN "runsShort" INTEGER NOT NULL DEFAULT 0;
