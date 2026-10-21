-- CreateEnum
CREATE TYPE "SanctionType" AS ENUM ('WARNING', 'APPLICATION_LOCK', 'COMPANY_SUSPENSION');

-- CreateEnum
CREATE TYPE "SanctionTargetType" AS ENUM ('STUDENT', 'COMPANY');

-- CreateEnum
CREATE TYPE "SanctionStatus" AS ENUM ('ACTIVE', 'LIFTED');

-- CreateTable
CREATE TABLE "Sanction" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "targetType" "SanctionTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "SanctionType" NOT NULL,
    "status" "SanctionStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "imposedBy" TEXT NOT NULL,
    "liftedBy" TEXT,
    "liftedAt" TIMESTAMP(3),
    "liftReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sanction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanctionEvent" (
    "id" TEXT NOT NULL,
    "sanctionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SanctionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sanction_reportId_key" ON "Sanction"("reportId");

-- CreateIndex
CREATE INDEX "Sanction_targetType_targetId_status_idx" ON "Sanction"("targetType", "targetId", "status");

-- CreateIndex
CREATE INDEX "Sanction_status_createdAt_idx" ON "Sanction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SanctionEvent_sanctionId_idx" ON "SanctionEvent"("sanctionId");

-- AddForeignKey
ALTER TABLE "SanctionEvent" ADD CONSTRAINT "SanctionEvent_sanctionId_fkey" FOREIGN KEY ("sanctionId") REFERENCES "Sanction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
