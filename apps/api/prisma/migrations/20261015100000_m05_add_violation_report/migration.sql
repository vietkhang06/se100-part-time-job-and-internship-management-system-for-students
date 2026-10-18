-- CreateEnum
CREATE TYPE "ViolationTargetType" AS ENUM ('COMPANY', 'STUDENT', 'JOB', 'REVIEW');

-- CreateEnum
CREATE TYPE "ViolationReason" AS ENUM ('FRAUD', 'FAKE_INFORMATION', 'HARASSMENT', 'SPAM', 'INAPPROPRIATE_CONTENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ViolationReportStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'SUBSTANTIATED', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ViolationEvidenceKind" AS ENUM ('URL', 'FILE');

-- CreateTable
CREATE TABLE "ViolationReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ViolationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT,
    "reason" "ViolationReason" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ViolationReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "openKey" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViolationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViolationEvidence" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "kind" "ViolationEvidenceKind" NOT NULL,
    "url" TEXT,
    "storageKey" TEXT,
    "fileName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViolationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ViolationReport_openKey_key" ON "ViolationReport"("openKey");

-- CreateIndex
CREATE INDEX "ViolationReport_reporterId_createdAt_idx" ON "ViolationReport"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "ViolationReport_targetType_targetId_idx" ON "ViolationReport"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ViolationReport_status_idx" ON "ViolationReport"("status");

-- CreateIndex
CREATE INDEX "ViolationEvidence_reportId_idx" ON "ViolationEvidence"("reportId");

-- AddForeignKey
ALTER TABLE "ViolationEvidence" ADD CONSTRAINT "ViolationEvidence_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ViolationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
