-- MIGRATION PENDING M04/M05 CONFIRMATION — DO NOT MERGE
-- Migration for S6-M03-01, S6-M03-02: View deduplication logs and expiry reminder logs

-- CreateTable
CREATE TABLE "JobViewLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "viewDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobViewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobExpiryReminderLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "deadlineDate" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobExpiryReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobViewLog_jobId_idx" ON "JobViewLog"("jobId");

-- CreateIndex
CREATE INDEX "JobViewLog_viewDate_idx" ON "JobViewLog"("viewDate");

-- CreateIndex
CREATE UNIQUE INDEX "JobViewLog_jobId_viewerKey_viewDate_key" ON "JobViewLog"("jobId", "viewerKey", "viewDate");

-- CreateIndex
CREATE INDEX "JobExpiryReminderLog_jobId_idx" ON "JobExpiryReminderLog"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobExpiryReminderLog_jobId_recipientId_deadlineDate_key" ON "JobExpiryReminderLog"("jobId", "recipientId", "deadlineDate");

-- AddForeignKey
ALTER TABLE "JobViewLog" ADD CONSTRAINT "JobViewLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobExpiryReminderLog" ADD CONSTRAINT "JobExpiryReminderLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
