-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('JOB', 'REPORT', 'REVIEW');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN', 'RESTORED', 'SUBSTANTIATED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ModerationDecisionType" AS ENUM ('APPROVE', 'REJECT', 'HIDE', 'RESTORE', 'SUBSTANTIATE', 'DISMISS');

-- CreateTable
CREATE TABLE "ModerationItem" (
    "id" TEXT NOT NULL,
    "targetType" "ModerationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "submitterId" TEXT,
    "assigneeId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationDecision" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "decision" "ModerationDecisionType" NOT NULL,
    "reason" TEXT,
    "proposedAction" TEXT,
    "reviewerId" TEXT NOT NULL,
    "targetSyncedAt" TIMESTAMP(3),
    "targetSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModerationItem_targetType_targetId_round_key" ON "ModerationItem"("targetType", "targetId", "round");

-- CreateIndex
CREATE INDEX "ModerationItem_status_targetType_enqueuedAt_idx" ON "ModerationItem"("status", "targetType", "enqueuedAt");

-- CreateIndex
CREATE INDEX "ModerationItem_assigneeId_idx" ON "ModerationItem"("assigneeId");

-- CreateIndex
CREATE INDEX "ModerationDecision_itemId_idx" ON "ModerationDecision"("itemId");

-- CreateIndex
CREATE INDEX "ModerationDecision_targetSyncedAt_idx" ON "ModerationDecision"("targetSyncedAt");

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ModerationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
