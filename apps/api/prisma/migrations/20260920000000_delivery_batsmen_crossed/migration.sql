-- Law 18.12: whether batters had crossed when a run-out (or catch) fell.
ALTER TABLE "Delivery" ADD COLUMN "batsmenCrossed" BOOLEAN NOT NULL DEFAULT false;
