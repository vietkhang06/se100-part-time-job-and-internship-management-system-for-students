-- CreateEnum
CREATE TYPE "CompanyMemberRole" AS ENUM ('OWNER', 'ADMIN', 'HR_MANAGER', 'RECRUITER', 'MEMBER');

-- CreateEnum
CREATE TYPE "CompanyMemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CompanyVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BUSINESS_LICENSE', 'TAX_REGISTRATION', 'OPERATION_PERMIT', 'OTHER');

-- CreateTable Company
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT NOT NULL,
    "website" TEXT,
    "industry" TEXT,
    "companySize" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "verificationStatus" "CompanyVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_taxId_key" ON "Company"("taxId");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "Company_taxId_idx" ON "Company"("taxId");

-- CreateIndex
CREATE INDEX "Company_verificationStatus_idx" ON "Company"("verificationStatus");

-- CreateTable CompanyMember
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "CompanyMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_companyId_userId_key" ON "CompanyMember"("companyId", "userId");

-- CreateIndex
CREATE INDEX "CompanyMember_companyId_idx" ON "CompanyMember"("companyId");

-- CreateIndex
CREATE INDEX "CompanyMember_userId_idx" ON "CompanyMember"("userId");

-- CreateIndex
CREATE INDEX "CompanyMember_role_idx" ON "CompanyMember"("role");

-- CreateTable CompanyBranch
CREATE TABLE "CompanyBranch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "ward" TEXT,
    "district" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Vietnam',
    "phone" TEXT,
    "email" TEXT,
    "isHeadquarter" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyBranch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyBranch_companyId_idx" ON "CompanyBranch"("companyId");

-- CreateIndex
CREATE INDEX "CompanyBranch_city_idx" ON "CompanyBranch"("city");

-- CreateTable CompanyVerification
CREATE TABLE "CompanyVerification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "CompanyVerificationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyVerification_companyId_idx" ON "CompanyVerification"("companyId");

-- CreateIndex
CREATE INDEX "CompanyVerification_reviewerId_idx" ON "CompanyVerification"("reviewerId");

-- CreateIndex
CREATE INDEX "CompanyVerification_status_idx" ON "CompanyVerification"("status");

-- CreateTable CompanyVerificationDocument
CREATE TABLE "CompanyVerificationDocument" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL DEFAULT 'BUSINESS_LICENSE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyVerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyVerificationDocument_verificationId_fileAssetId_key" ON "CompanyVerificationDocument"("verificationId", "fileAssetId");

-- CreateIndex
CREATE INDEX "CompanyVerificationDocument_verificationId_idx" ON "CompanyVerificationDocument"("verificationId");

-- CreateIndex
CREATE INDEX "CompanyVerificationDocument_fileAssetId_idx" ON "CompanyVerificationDocument"("fileAssetId");

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBranch" ADD CONSTRAINT "CompanyBranch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyVerification" ADD CONSTRAINT "CompanyVerification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyVerification" ADD CONSTRAINT "CompanyVerification_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyVerificationDocument" ADD CONSTRAINT "CompanyVerificationDocument_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "CompanyVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyVerificationDocument" ADD CONSTRAINT "CompanyVerificationDocument_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
