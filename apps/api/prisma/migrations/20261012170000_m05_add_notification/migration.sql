-- CreateEnum
CREATE TYPE "NotificationEmailStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "emailStatus" "NotificationEmailStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailLastError" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "emailNextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_emailStatus_emailNextRetryAt_idx" ON "Notification"("emailStatus", "emailNextRetryAt");
