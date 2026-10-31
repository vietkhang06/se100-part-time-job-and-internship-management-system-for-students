import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  BadRequestException,
} from '@nestjs/common';
import {
  CompanyVerificationStatus,
  CompanyMemberRole,
  CompanyMemberStatus,
  UserRole,
  UserStatus,
  JobType,
  JobStatus,
  DocumentType,
} from '@campusjob/contracts';
import { PrismaCompanyRepository } from './prisma-company.repository';
import { PrismaCompanyMemberRepository } from './prisma-company-member.repository';
import { PrismaCompanyBranchRepository } from './prisma-company-branch.repository';
import { PrismaCompanyVerificationRepository } from './prisma-company-verification.repository';
import { PrismaJobPostingRepository } from './prisma-job-posting.repository';
import { CompanyMemberEntity } from '../../domain/entities/company-member.entity';
import { ResumeJobPostingUseCase } from '../../application/use-cases/resume-job-posting.use-case';

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://campusjob:campusjob_dev@localhost:5435/campusjob_m03_scratch?schema=public';

describe('Prisma Repositories Integration & Composite FK (Scratch DB)', () => {
  let prisma: PrismaService;
  let companyRepo: PrismaCompanyRepository;
  let memberRepo: PrismaCompanyMemberRepository;
  let branchRepo: PrismaCompanyBranchRepository;
  let verificationRepo: PrismaCompanyVerificationRepository;
  let jobPostingRepo: PrismaJobPostingRepository;

  let isDbAvailable = false;
  const testRunId = Date.now().toString(36);

  let userA: { id: string };
  let adminUser: { id: string };

  beforeAll(async () => {
    prisma = new PrismaService({
      datasources: {
        db: { url: databaseUrl },
      },
    });

    try {
      await prisma.$connect();
      await prisma.$executeRaw`SELECT 1`;
      isDbAvailable = true;
    } catch {
      isDbAvailable = false;
      return;
    }

    companyRepo = new PrismaCompanyRepository(prisma as any);
    memberRepo = new PrismaCompanyMemberRepository(prisma as any);
    branchRepo = new PrismaCompanyBranchRepository(prisma as any);
    verificationRepo = new PrismaCompanyVerificationRepository(prisma as any);
    jobPostingRepo = new PrismaJobPostingRepository(prisma as any);

    // Create test users for relations
    userA = await prisma.user.create({
      data: {
        id: `user-m03-${testRunId}-a`,
        email: `employer-${testRunId}@example.com`,
        passwordHash: 'dummy-hash',
        fullName: 'Employer Integration',
        role: UserRole.EMPLOYER,
        status: UserStatus.ACTIVE,
      },
    });

    adminUser = await prisma.user.create({
      data: {
        id: `admin-m03-${testRunId}`,
        email: `admin-${testRunId}@example.com`,
        passwordHash: 'dummy-hash',
        fullName: 'Admin Integration',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    if (!isDbAvailable) return;

    try {
      // Clean up test data
      await prisma.savedJob.deleteMany({
        where: { job: { company: { taxId: { contains: testRunId } } } },
      });
      await prisma.jobPosting.deleteMany({
        where: { company: { taxId: { contains: testRunId } } },
      });
      await prisma.companyVerificationDocument.deleteMany({
        where: { verification: { company: { taxId: { contains: testRunId } } } },
      });
      await prisma.companyVerification.deleteMany({
        where: { company: { taxId: { contains: testRunId } } },
      });
      await prisma.companyMember.deleteMany({
        where: { company: { taxId: { contains: testRunId } } },
      });
      await prisma.companyBranch.deleteMany({
        where: { company: { taxId: { contains: testRunId } } },
      });
      await prisma.company.deleteMany({
        where: { taxId: { contains: testRunId } },
      });
      await prisma.fileAsset.deleteMany({
        where: { ownerUserId: { in: [userA.id, adminUser.id] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [userA.id, adminUser.id] } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('1. PrismaCompanyRepository: create, findById, findByTaxId, and save', async () => {
    if (!isDbAvailable) {
      console.warn('Scratch DB not available, skipping test');
      return;
    }

    const created = await companyRepo.create({
      name: `Acme Integration ${testRunId}`,
      taxId: `TAX-${testRunId}-1`,
      representativeName: 'Nguyen Van Represent',
      verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe(`Acme Integration ${testRunId}`);
    expect(created.representativeName).toBe('Nguyen Van Represent');

    const byId = await companyRepo.findById(created.id);
    expect(byId).not.toBeNull();
    expect(byId?.id).toBe(created.id);
    expect(byId?.representativeName).toBe('Nguyen Van Represent');

    const byTax = await companyRepo.findByTaxId(`TAX-${testRunId}-1`);
    expect(byTax).not.toBeNull();
    expect(byTax?.id).toBe(created.id);

    // Save update
    created.updateProfile({
      name: `Acme Renamed ${testRunId}`,
      representativeName: 'Nguyen Van Renamed',
    });
    const saved = await companyRepo.save(created);
    expect(saved.name).toBe(`Acme Renamed ${testRunId}`);
    expect(saved.representativeName).toBe('Nguyen Van Renamed');
  });

  it('2. PrismaCompanyMemberRepository: create, findByCompanyAndUser, findActiveByUserId, and save', async () => {
    if (!isDbAvailable) return;

    const company = await companyRepo.create({
      name: `Member Test Corp ${testRunId}`,
      taxId: `TAX-${testRunId}-2`,
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });

    const member = await memberRepo.create({
      companyId: company.id,
      userId: userA.id,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    expect(member.id).toBeDefined();
    expect(member.role).toBe(CompanyMemberRole.OWNER);

    const found = await memberRepo.findByCompanyAndUser(company.id, userA.id);
    expect(found).not.toBeNull();
    expect(found?.role).toBe(CompanyMemberRole.OWNER);

    const active = await memberRepo.findActiveByUserId(userA.id);
    expect(active).not.toBeNull();
    expect(active?.companyId).toBe(company.id);

    // Update status to SUSPENDED via new entity instance
    const updatedMember = new CompanyMemberEntity({
      id: member.id,
      companyId: member.companyId,
      userId: member.userId,
      role: CompanyMemberRole.ADMIN,
      status: CompanyMemberStatus.SUSPENDED,
      joinedAt: member.joinedAt,
      createdAt: member.createdAt,
    });
    const saved = await memberRepo.save(updatedMember);
    expect(saved.status).toBe(CompanyMemberStatus.SUSPENDED);
    expect(saved.role).toBe(CompanyMemberRole.ADMIN);
  });

  it('3. PrismaCompanyBranchRepository: create, findById, findByCompanyId, save, unsetHeadquarter, delete', async () => {
    if (!isDbAvailable) return;

    const company = await companyRepo.create({
      name: `Branch Corp ${testRunId}`,
      taxId: `TAX-${testRunId}-3`,
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });

    const b1 = await branchRepo.create({
      companyId: company.id,
      branchName: 'Headquarters',
      addressLine: '123 Nguyen Hue',
      city: 'Ho Chi Minh',
      latitude: 10.7769,
      longitude: 106.7009,
      isHeadquarter: true,
    });

    expect(b1.id).toBeDefined();
    expect(b1.latitude).toBe(10.7769);
    expect(b1.longitude).toBe(106.7009);
    expect(b1.isHeadquarter).toBe(true);

    const b2 = await branchRepo.create({
      companyId: company.id,
      branchName: 'Branch 2',
      addressLine: '456 Le Loi',
      city: 'Da Nang',
      latitude: 16.0544,
      longitude: 108.2022,
      isHeadquarter: false,
    });

    const branches = await branchRepo.findByCompanyId(company.id);
    expect(branches.length).toBe(2);

    // Unset headquarter
    await branchRepo.unsetHeadquarter(company.id);
    const refreshedB1 = await branchRepo.findById(b1.id);
    expect(refreshedB1?.isHeadquarter).toBe(false);

    // Delete b2
    await branchRepo.delete(b2.id);
    const deletedB2 = await branchRepo.findById(b2.id);
    expect(deletedB2).toBeNull();
  });

  it('4. PrismaCompanyVerificationRepository: createVerification, findLatest, recordDecision', async () => {
    if (!isDbAvailable) return;

    const company = await companyRepo.create({
      name: `Verif Corp ${testRunId}`,
      taxId: `TAX-${testRunId}-4`,
      verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
    });

    const fileAsset = await prisma.fileAsset.create({
      data: {
        id: `fa-${testRunId}-1`,
        ownerUserId: userA.id,
        storageKey: `companies/docs/${testRunId}.pdf`,
        originalName: 'license.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        status: 'PERMANENT',
      },
    });

    const record = await verificationRepo.createVerification({
      companyId: company.id,
      status: CompanyVerificationStatus.PENDING_REVIEW,
      documents: [
        {
          fileAssetId: fileAsset.id,
          documentType: DocumentType.BUSINESS_LICENSE,
        },
      ],
    });

    expect(record.id).toBeDefined();
    expect(record.documents.length).toBe(1);
    expect(record.documents[0].fileAssetId).toBe(fileAsset.id);

    const latest = await verificationRepo.findLatestByCompanyId(company.id);
    expect(latest?.id).toBe(record.id);

    // Record decision: REJECTED with reason and reviewer
    const decided = await verificationRepo.recordDecision({
      verificationId: record.id,
      reviewerId: adminUser.id,
      status: CompanyVerificationStatus.REJECTED,
      rejectionReason: 'Invalid seal',
    });

    expect(decided.status).toBe(CompanyVerificationStatus.REJECTED);
    expect(decided.reviewerId).toBe(adminUser.id);
    expect(decided.rejectionReason).toBe('Invalid seal');
    expect(decided.reviewedAt).toBeDefined();
  });

  it('5. Composite FK: rejecting a job pointing to another company branch, and branch deletion guard', async () => {
    if (!isDbAvailable) return;

    // Company A and Branch A
    const companyA = await companyRepo.create({
      name: `Company A ${testRunId}`,
      taxId: `TAX-${testRunId}-A`,
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });
    const branchA = await branchRepo.create({
      companyId: companyA.id,
      branchName: 'Branch A',
      addressLine: 'A Street',
      city: 'Hanoi',
    });

    // Company B and Branch B
    const companyB = await companyRepo.create({
      name: `Company B ${testRunId}`,
      taxId: `TAX-${testRunId}-B`,
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });
    const branchB = await branchRepo.create({
      companyId: companyB.id,
      branchName: 'Branch B',
      addressLine: 'B Street',
      city: 'HCMC',
    });

    // Cross-company Job insertion: Job points to Company A, but branchId = branchB.id
    // This MUST violate the composite foreign key:
    // (branchId, companyId) REFERENCES CompanyBranch(id, companyId)
    await expect(
      prisma.jobPosting.create({
        data: {
          id: `job-cross-${testRunId}`,
          companyId: companyA.id,
          branchId: branchB.id, // Belonging to Company B!
          title: 'Cross-Company Illegal Job',
          description: 'Should fail at DB level',
          industry: 'IT',
          type: JobType.PART_TIME,
          quantity: 1,
          deadline: new Date(Date.now() + 86400000),
          status: JobStatus.PENDING_APPROVAL,
          salaryMin: new Prisma.Decimal(5000000),
          salaryMax: new Prisma.Decimal(10000000),
        },
      }),
    ).rejects.toThrow();

    // Valid Job insertion: Job points to Company A and branchA.id (same company)
    const validJob = await prisma.jobPosting.create({
      data: {
        id: `job-valid-${testRunId}`,
        companyId: companyA.id,
        branchId: branchA.id,
        title: 'Valid Job Same Company Branch',
        description: 'Should succeed',
        industry: 'IT',
        type: JobType.PART_TIME,
        quantity: 2,
        deadline: new Date(Date.now() + 86400000),
        status: JobStatus.PENDING_APPROVAL,
        salaryMin: new Prisma.Decimal(5000000),
        salaryMax: new Prisma.Decimal(10000000),
      },
    });

    expect(validJob.id).toBe(`job-valid-${testRunId}`);
    expect(Number(validJob.salaryMin)).toBe(5000000);
    expect(Number(validJob.salaryMax)).toBe(10000000);

    // Verify branch usage checker
    const isBranchAInUse = await branchRepo.isBranchInUse(branchA.id);
    expect(isBranchAInUse).toBe(true);

    const isBranchBInUse = await branchRepo.isBranchInUse(branchB.id);
    expect(isBranchBInUse).toBe(false);

    // Attempt to delete branchA should fail at DB level due to ON DELETE RESTRICT on composite FK
    await expect(branchRepo.delete(branchA.id)).rejects.toThrow();

    // Clean up validJob so afterAll cascades cleanly
    await prisma.jobPosting.delete({ where: { id: validJob.id } });
  });

  it('6. PrismaJobPostingRepository: durable rejection, hiddenByModeration flag, and persisted auto-close on expired job', async () => {
    if (!isDbAvailable) return;

    const company = await companyRepo.create({
      name: `Job Repo Corp ${testRunId}`,
      taxId: `TAX-${testRunId}-J`,
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });

    await memberRepo.create({
      companyId: company.id,
      userId: userA.id,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    const branch = await branchRepo.create({
      companyId: company.id,
      branchName: 'Job Branch',
      addressLine: '789 Le Duan',
      city: 'Da Nang',
    });

    // 1. Create job with durable rejection fields
    const createdJob = await jobPostingRepo.create({
      companyId: company.id,
      branchId: branch.id,
      title: 'DevOps Engineer',
      description: 'CI/CD pipeline lead',
      industry: 'IT',
      type: JobType.FULL_TIME,
      skills: ['Docker', 'Kubernetes'],
      quantity: 1,
      deadline: new Date(Date.now() + 7 * 86400000),
      status: JobStatus.PENDING_APPROVAL,
      rejectionReason: 'Thiếu thông tin chứng chỉ.',
      rejectedAt: new Date(),
    });

    expect(createdJob.rejectionReason).toBe('Thiếu thông tin chứng chỉ.');
    expect(createdJob.rejectedAt).toBeDefined();
    expect(createdJob.hiddenByModeration).toBe(false);

    // Verify DB direct persistence
    const dbRow1 = await prisma.jobPosting.findUnique({
      where: { id: createdJob.id },
    });
    expect(dbRow1?.rejectionReason).toBe('Thiếu thông tin chứng chỉ.');
    expect(dbRow1?.rejectedAt).not.toBeNull();
    expect(dbRow1?.hiddenByModeration).toBe(false);

    // 2. Update with hiddenByModeration: true
    const updatedJob = await jobPostingRepo.update(createdJob.id, {
      status: JobStatus.PAUSED,
      hiddenByModeration: true,
    });
    expect(updatedJob.status).toBe(JobStatus.PAUSED);
    expect(updatedJob.hiddenByModeration).toBe(true);

    const dbRow2 = await prisma.jobPosting.findUnique({
      where: { id: createdJob.id },
    });
    expect(dbRow2?.status).toBe('PAUSED');
    expect(dbRow2?.hiddenByModeration).toBe(true);

    // 3. Persisted auto-close on expired job (no rollback of close)
    const expiredJob = await jobPostingRepo.create({
      companyId: company.id,
      branchId: branch.id,
      title: 'Expired Java Job',
      description: 'Legacy stack',
      industry: 'IT',
      type: JobType.FULL_TIME,
      skills: ['Java'],
      quantity: 1,
      deadline: new Date(Date.now() - 3600000), // Expired 1 hour ago
      status: JobStatus.PAUSED,
    });

    const resumeUseCase = new ResumeJobPostingUseCase(
      jobPostingRepo,
      memberRepo,
      companyRepo,
    );

    // Calling resume on expired job must throw BadRequestException
    await expect(
      resumeUseCase.execute(userA.id, expiredJob.id),
    ).rejects.toThrow(BadRequestException);

    // CRITICAL: The status change to CLOSED must persist in PostgreSQL (no transaction rollback)
    const dbRowExpired = await prisma.jobPosting.findUnique({
      where: { id: expiredJob.id },
    });
    expect(dbRowExpired?.status).toBe('CLOSED');
  });
});
