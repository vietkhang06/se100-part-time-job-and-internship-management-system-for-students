-- CreateEnum
CREATE TYPE "FileAssetStatus" AS ENUM ('PENDING_UPLOAD', 'PERMANENT', 'PENDING_DELETION');

-- CreateTable FileAsset
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "FileAssetStatus" NOT NULL DEFAULT 'PERMANENT',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");

-- CreateIndex
CREATE INDEX "FileAsset_ownerUserId_idx" ON "FileAsset"("ownerUserId");

-- CreateIndex
CREATE INDEX "FileAsset_storageKey_idx" ON "FileAsset"("storageKey");

-- CreateIndex
CREATE INDEX "FileAsset_status_idx" ON "FileAsset"("status");

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Cv
ALTER TABLE "Cv" ADD COLUMN "fileAssetId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Cv_fileAssetId_key" ON "Cv"("fileAssetId");

-- AddForeignKey
ALTER TABLE "Cv" ADD CONSTRAINT "Cv_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Resolve duplicate defaults deterministically if any exist before adding unique index
WITH ranked_defaults AS (
    SELECT id, "studentProfileId",
           ROW_NUMBER() OVER (PARTITION BY "studentProfileId" ORDER BY "updatedAt" DESC, "createdAt" DESC) as rn
    FROM "Cv"
    WHERE "isDefault" = true
)
UPDATE "Cv"
SET "isDefault" = false
WHERE id IN (
    SELECT id FROM ranked_defaults WHERE rn > 1
);

-- Create partial unique index enforcing at most one default CV per student profile in the database
CREATE UNIQUE INDEX "Cv_studentProfileId_isDefault_unique_idx"
ON "Cv"("studentProfileId")
WHERE "isDefault" = true;
