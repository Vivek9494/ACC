-- Tournament registration fees (tennis single fee / leather full-time + part-time).
ALTER TABLE "Tournament" ADD COLUMN "feeFullTime" DECIMAL(10, 2);
ALTER TABLE "Tournament" ADD COLUMN "feePartTime" DECIMAL(10, 2);
