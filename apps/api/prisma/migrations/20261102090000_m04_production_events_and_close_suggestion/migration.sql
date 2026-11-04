-- S5-M04-03/S5-M04-04: idempotent close suggestions and transactional M04 outbox.
CREATE TABLE "M04EventOutbox" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "M04EventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "M04EventOutbox_dedupeKey_key" ON "M04EventOutbox"("dedupeKey");
CREATE INDEX "M04EventOutbox_publishedAt_availableAt_createdAt_idx"
  ON "M04EventOutbox"("publishedAt", "availableAt", "createdAt");

CREATE TABLE "JobCloseSuggestion" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "acceptedCount" INTEGER NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobCloseSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobCloseSuggestion_jobId_key" ON "JobCloseSuggestion"("jobId");
CREATE INDEX "JobCloseSuggestion_createdAt_idx" ON "JobCloseSuggestion"("createdAt");
ALTER TABLE "JobCloseSuggestion" ADD CONSTRAINT "JobCloseSuggestion_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
