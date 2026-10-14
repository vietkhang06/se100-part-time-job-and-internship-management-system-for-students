-- CreateTable
CREATE TABLE "Cv" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "fileUrl" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "educations" JSONB NOT NULL DEFAULT '[]',
    "experiences" JSONB NOT NULL DEFAULT '[]',
    "projects" JSONB NOT NULL DEFAULT '[]',
    "certifications" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cv_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cv_studentProfileId_idx" ON "Cv"("studentProfileId");

-- CreateIndex
CREATE INDEX "Cv_studentProfileId_isDefault_idx" ON "Cv"("studentProfileId", "isDefault");

-- AddForeignKey
ALTER TABLE "Cv" ADD CONSTRAINT "Cv_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
