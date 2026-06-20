-- Relay run-out second fielder on Delivery.
ALTER TABLE "Delivery" ADD COLUMN "fielder2UserId" TEXT;
ALTER TABLE "Delivery" ADD COLUMN "fielder2ExternalId" TEXT;
