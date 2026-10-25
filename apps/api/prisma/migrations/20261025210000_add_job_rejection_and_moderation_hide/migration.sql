-- MIGRATION PENDING M04/M05 CONFIRMATION — DO NOT MERGE
-- Migration for S2-M03-05, S5-M03-01, S2-M03-04: Durable rejection and moderation hide flag

-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "hiddenByModeration" BOOLEAN NOT NULL DEFAULT false;
