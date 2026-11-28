-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "campusEmail" TEXT,
ADD COLUMN     "campusVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "isCampusVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CampusEmailVerificationToken" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "campusEmail" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampusEmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampusEmailVerificationToken_studentProfileId_createdAt_idx" ON "CampusEmailVerificationToken"("studentProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "CampusEmailVerificationToken_studentProfileId_campusEmail_u_idx" ON "CampusEmailVerificationToken"("studentProfileId", "campusEmail", "usedAt");

-- CreateIndex
CREATE INDEX "CampusEmailVerificationToken_expiresAt_idx" ON "CampusEmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_campusEmail_key" ON "StudentProfile"("campusEmail");

-- AddForeignKey
ALTER TABLE "CampusEmailVerificationToken" ADD CONSTRAINT "CampusEmailVerificationToken_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

