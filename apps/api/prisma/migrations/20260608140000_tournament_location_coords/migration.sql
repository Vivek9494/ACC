-- Rename free-text location to structured address; add coordinates for map/geofence use.
ALTER TABLE "Tournament" RENAME COLUMN "location" TO "locationAddress";
ALTER TABLE "Tournament" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Tournament" ADD COLUMN "longitude" DOUBLE PRECISION;
