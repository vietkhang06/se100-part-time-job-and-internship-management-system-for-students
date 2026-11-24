-- CreateTable
CREATE TABLE "NotificationEmailPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationEmailPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEmailPreference_userId_eventType_key" ON "NotificationEmailPreference"("userId", "eventType");

-- CreateIndex
CREATE INDEX "NotificationEmailPreference_userId_idx" ON "NotificationEmailPreference"("userId");

-- AddForeignKey
ALTER TABLE "NotificationEmailPreference" ADD CONSTRAINT "NotificationEmailPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
