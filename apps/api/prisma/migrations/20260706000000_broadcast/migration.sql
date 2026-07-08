-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT,
    "text" TEXT,
    "postedBy" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Broadcast_postedAt_idx" ON "Broadcast"("postedAt");

-- CreateIndex
CREATE INDEX "Broadcast_expiresAt_idx" ON "Broadcast"("expiresAt");

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_postedBy_fkey" FOREIGN KEY ("postedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
