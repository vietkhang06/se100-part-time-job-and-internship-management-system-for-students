import { PrismaClient, Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CompanyVerificationStatus,
  CompanyMemberRole,
  CompanyMemberStatus,
  UserRole,
  UserStatus,
  JobType,
  JobStatus,
} from '@campusjob/contracts';
import { AppModule } from '../../../../app.module';
import {
  ICompanyRepository,
  COMPANY_REPOSITORY_TOKEN,
} from '../../domain/repositories/company.repository.interface';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';
import {
  ICompanyBranchRepository,
  COMPANY_BRANCH_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-branch.repository.interface';
import {
  ICompanyMemberRepository,
  COMPANY_MEMBER_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-member.repository.interface';
import { SearchPublicJobsUseCase } from '../../application/use-cases/search-public-jobs.use-case';
import { GetPublicJobDetailUseCase } from '../../application/use-cases/get-public-job-detail.use-case';
import { SearchPublicCompaniesUseCase } from '../../application/use-cases/search-public-companies.use-case';
import { GetPublicCompanyDetailUseCase } from '../../application/use-cases/get-public-company-detail.use-case';
import { JobAccessSource, M04WorkflowError } from '../../../applications/application/m04-ports';
import { JobAccessSourceAdapter } from '../adapters/job-access-source.adapter';
import { M04_JOB_SOURCE } from '../../../applications/m04.module';

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://campusjob:campusjob_dev@localhost:5435/campusjob_m03_scratch?schema=public';

process.env.DATABASE_URL = databaseUrl;

describe('Prisma Public Read & JobAccessSource (Real PostgreSQL Scratch DB)', () => {
  let prisma: PrismaClient;
  let moduleFixture: TestingModule;
  let isDbAvailable = false;

  let companyRepo: ICompanyRepository;
  let jobPostingRepo: IJobPostingRepository;
  let branchRepo: ICompanyBranchRepository;
  let memberRepo: ICompanyMemberRepository;

  let searchPublicJobsUseCase: SearchPublicJobsUseCase;
  let getPublicJobDetailUseCase: GetPublicJobDetailUseCase;
  let searchPublicCompaniesUseCase: SearchPublicCompaniesUseCase;
  let getPublicCompanyDetailUseCase: GetPublicCompanyDetailUseCase;
  let jobAccessSource: JobAccessSource;

  const testRunId = Date.now().toString(36);

  // Entities created during setup
  let employerUser: { id: string };
  let otherUser: { id: string };

  let verifiedCompany: any;
  let unverifiedCompany: any;

  let branchHN: any;
  let branchHCM: any;
  let branchUnv: any;

  // Filter test jobs
  let jobReactHN: any;
  let jobNestHCM: any;
  let jobFinanceHN: any;
  let jobMarketingHCM: any;

  // Excluded jobs
  let jobPending: any;
  let jobPaused: any;
  let jobClosed: any;
  let jobExpired: any;
  let jobHidden: any;
  let jobUnverifiedCompany: any;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });

    try {
      await prisma.$connect();
      await prisma.$executeRaw`SELECT 1`;
      isDbAvailable = true;
    } catch (err) {
      console.warn('Scratch database not available on port 5435, skipping real-DB integration tests.', err);
      isDbAvailable = false;
      return;
    }

    // Initialize through the production NestJS module graph (AppModule)
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    await moduleFixture.init();

    companyRepo = moduleFixture.get<ICompanyRepository>(COMPANY_REPOSITORY_TOKEN);
    jobPostingRepo = moduleFixture.get<IJobPostingRepository>(JOB_POSTING_REPOSITORY_TOKEN);
    branchRepo = moduleFixture.get<ICompanyBranchRepository>(COMPANY_BRANCH_REPOSITORY_TOKEN);
    memberRepo = moduleFixture.get<ICompanyMemberRepository>(COMPANY_MEMBER_REPOSITORY_TOKEN);

    searchPublicJobsUseCase = moduleFixture.get<SearchPublicJobsUseCase>(SearchPublicJobsUseCase);
    getPublicJobDetailUseCase = moduleFixture.get<GetPublicJobDetailUseCase>(GetPublicJobDetailUseCase);
    searchPublicCompaniesUseCase = moduleFixture.get<SearchPublicCompaniesUseCase>(SearchPublicCompaniesUseCase);
    getPublicCompanyDetailUseCase = moduleFixture.get<GetPublicCompanyDetailUseCase>(GetPublicCompanyDetailUseCase);

    jobAccessSource = moduleFixture.get<JobAccessSource>(M04_JOB_SOURCE);


    // 1. Seed users
    employerUser = await prisma.user.create({
      data: {
        id: `user-m03-pub-${testRunId}-emp`,
        email: `employer-pub-${testRunId}@example.com`,
        passwordHash: 'dummy-hash',
        fullName: 'Employer Real DB Test',
        role: UserRole.EMPLOYER,
        status: UserStatus.ACTIVE,
      },
    });

    otherUser = await prisma.user.create({
      data: {
        id: `user-m03-pub-${testRunId}-oth`,
        email: `other-pub-${testRunId}@example.com`,
        passwordHash: 'dummy-hash',
        fullName: 'Other User Test',
        role: UserRole.EMPLOYER,
        status: UserStatus.ACTIVE,
      },
    });

    // 2. Seed verified company and unverified company
    verifiedCompany = await companyRepo.create({
      name: `F1-Tech-Verified-${testRunId}`,
      taxId: `TAX-VERIFIED-${testRunId}`,
      industry: 'IT_SOFTWARE',
      companySize: '100-500',
      description: 'Công ty công nghệ phần mềm hàng đầu',
      address: '123 Đường Cầu Giấy, Hà Nội',
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });

    unverifiedCompany = await companyRepo.create({
      name: `F1-Pending-Company-${testRunId}`,
      taxId: `TAX-UNVERIFIED-${testRunId}`,
      industry: 'IT_SOFTWARE',
      companySize: '10-50',
      description: 'Công ty chưa được duyệt',
      address: '456 Đường Lê Lợi, TP. Hồ Chí Minh',
      verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
    });

    // Add employer as owner of verifiedCompany
    await memberRepo.create({
      companyId: verifiedCompany.id,
      userId: employerUser.id,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    // 3. Seed branches
    branchHN = await branchRepo.create({
      companyId: verifiedCompany.id,
      branchName: 'Chi nhánh Hà Nội Cầu Giấy',
      addressLine: '123 Cầu Giấy',
      city: 'Hà Nội',
      phone: '02411122233',
    });

    branchHCM = await branchRepo.create({
      companyId: verifiedCompany.id,
      branchName: 'Chi nhánh TP.HCM Quận 1',
      addressLine: '456 Lê Duẩn',
      city: 'TP. Hồ Chí Minh',
      phone: '02811122233',
    });

    branchUnv = await branchRepo.create({
      companyId: unverifiedCompany.id,
      branchName: 'Chi nhánh Chưa Duyệt',
      addressLine: '789 Trần Hưng Đạo',
      city: 'Đà Nẵng',
    });

    // 4. Seed filterable jobs under verified company
    const futureDate = new Date(Date.now() + 14 * 86400000);

    jobReactHN = await jobPostingRepo.create({
      companyId: verifiedCompany.id,
      branchId: branchHN.id,
      title: `Frontend React Developer ${testRunId}`,
      description: 'Phát triển ứng dụng Web ReactJS và TypeScript',
      industry: 'IT_SOFTWARE',
      type: JobType.FULL_TIME,
      skills: ['React', 'TypeScript'],
      quantity: 2,
      salaryMin: 15000000,
      salaryMax: 25000000,
      isSalaryNegotiable: false,
      schedule: 'Thứ 2 đến Thứ 6 (8h30 - 17h30)',
      deadline: futureDate,
      status: JobStatus.OPEN,
    });

    jobNestHCM = await jobPostingRepo.create({
      companyId: verifiedCompany.id,
      branchId: branchHCM.id,
      title: `Backend NodeJS Engineer ${testRunId}`,
      description: 'Xây dựng API microservices với NestJS và PostgreSQL',
      industry: 'IT_SOFTWARE',
      type: JobType.PART_TIME,
      skills: ['NestJS', 'PostgreSQL'],
      quantity: 3,
      salaryMin: 8000000,
      salaryMax: 12000000,
      isSalaryNegotiable: false,
      schedule: 'Ca tối linh hoạt',
      deadline: futureDate,
      status: JobStatus.OPEN,
    });

    jobFinanceHN = await jobPostingRepo.create({
      companyId: verifiedCompany.id,
      branchId: branchHN.id,
      title: `Finance Intern Analyst ${testRunId}`,
      description: 'Hỗ trợ đối soát số liệu kế toán và phân tích tài chính',
      industry: 'FINANCE',
      type: JobType.INTERNSHIP,
      skills: ['Excel', 'Accounting'],
      quantity: 1,
      salaryMin: 4000000,
      salaryMax: 6000000,
      isSalaryNegotiable: false,
      schedule: 'Sáng thứ 2 đến thứ 6',
      deadline: futureDate,
      status: JobStatus.OPEN,
    });

    jobMarketingHCM = await jobPostingRepo.create({
      companyId: verifiedCompany.id,
      branchId: branchHCM.id,
      title: `Digital Marketing Lead ${testRunId}`,
      description: 'Chạy chiến dịch Facebook Ads và SEO Content',
      industry: 'MARKETING',
      type: JobType.FULL_TIME,
      skills: ['SEO', 'Marketing'],
      quantity: 1,
      salaryMin: null,
      salaryMax: null,
      isSalaryNegotiable: true,
      schedule: 'Giờ hành chính',
      deadline: futureDate,
      status: JobStatus.OPEN,
    });

    // 5. Seed ineligible/excluded jobs
    jobPending = await jobPostingRepo.create({
      companyId: verifiedCompany.id,
      branchId: branchHN.id,
      title: `Pending Job ${testRunId}`,
      description: 'Chờ kiểm duyệt',
      industry: 'IT_SOFTWARE',
      type: JobType.FULL_TIME,
      skills: ['Skill1'],
      quantity: 1,
      deadline: futureDate,
      status: JobStatus.PENDING_APPROVAL,
      rejectionReason: 'Cần bổ sung chứng chỉ',
      rejectedAt: new Date(),
    });

    jobPaused = await jobPostingRepo.create({
      companyId: verifiedCompany.id,
      branchId: branchHN.id,
      title: `Paused Job ${testRunId}`,
      description: 'Đang tạm dừng',
      industry: 'IT_SOFTWARE',
      type: JobType.FULL_TIME,
      skills: ['Skill2'],
      quantity: 1,
      deadline: futureDate,
      status: JobStatus.PAUSED,
    });

    jobClosed = await jobPostingRepo.create({
      companyId: verifiedCompany.id,
      branchId: branchHN.id,
      title: `Closed Job ${testRunId}`,
      description: 'Đã đóng tuyển dụng',
      industry: 'IT_SOFTWARE',
      type: JobType.FULL_TIME,
      skills: ['Skill3'],
      quantity: 1,
      deadline: futureDate,
      status: JobStatus.CLOSED,
    });

    jobExpired = await jobPostingRepo.create({
      companyId: verifiedCompany.id,
      branchId: branchHN.id,
      title: `Expired Job ${testRunId}`,
      description: 'Đã hết hạn tuyển dụng hôm qua',
      industry: 'IT_SOFTWARE',
      type: JobType.FULL_TIME,
      skills: ['Skill4'],
      quantity: 1,
      deadline: new Date(Date.now() - 3600000), // Expired 1 hour ago
      status: JobStatus.OPEN,
    });

    jobHidden = await jobPostingRepo.create({
      companyId: verifiedCompany.id,
      branchId: branchHN.id,
      title: `Hidden Job ${testRunId}`,
      description: 'Bị ẩn bởi kiểm duyệt viên',
      industry: 'IT_SOFTWARE',
      type: JobType.FULL_TIME,
      skills: ['Skill5'],
      quantity: 1,
      deadline: futureDate,
      status: JobStatus.PAUSED,
      hiddenByModeration: true,
    });

    jobUnverifiedCompany = await jobPostingRepo.create({
      companyId: unverifiedCompany.id,
      branchId: branchUnv.id,
      title: `Job of Unverified Company ${testRunId}`,
      description: 'Doanh nghiệp chưa xác thực',
      industry: 'IT_SOFTWARE',
      type: JobType.FULL_TIME,
      skills: ['Skill6'],
      quantity: 1,
      deadline: futureDate,
      status: JobStatus.OPEN,
    });
  });

  afterAll(async () => {
    if (!isDbAvailable) return;

    try {
      await prisma.jobPosting.deleteMany({
        where: {
          company: {
            taxId: { in: [`TAX-VERIFIED-${testRunId}`, `TAX-UNVERIFIED-${testRunId}`] },
          },
        },
      });
      await prisma.companyBranch.deleteMany({
        where: {
          company: {
            taxId: { in: [`TAX-VERIFIED-${testRunId}`, `TAX-UNVERIFIED-${testRunId}`] },
          },
        },
      });
      await prisma.companyMember.deleteMany({
        where: {
          company: {
            taxId: { in: [`TAX-VERIFIED-${testRunId}`, `TAX-UNVERIFIED-${testRunId}`] },
          },
        },
      });
      await prisma.company.deleteMany({
        where: {
          taxId: { in: [`TAX-VERIFIED-${testRunId}`, `TAX-UNVERIFIED-${testRunId}`] },
        },
      });
      if (employerUser?.id || otherUser?.id) {
        await prisma.user.deleteMany({
          where: {
            id: { in: [employerUser?.id, otherUser?.id].filter(Boolean) as string[] },
          },
        });
      }
    } finally {
      if (moduleFixture) {
        await moduleFixture.close();
      }
      await prisma.$disconnect();
    }
  });

  // ==========================================================================
  // F1: PRISMA Repositories & Use Cases Public Read (Real PostgreSQL)
  // ==========================================================================
  describe('F1 - Prisma Repositories searchPublic Filters (Real DB)', () => {
    it('1. Filter alone: keyword matches title or description (case-insensitive)', async () => {
      if (!isDbAvailable) return;

      // Match title: 'React'
      const resTitle = await jobPostingRepo.searchPublic({
        keyword: 'react',
      });
      const idsTitle = resTitle.jobs.map((j) => j.job.id);
      expect(idsTitle).toContain(jobReactHN.id);
      expect(idsTitle).not.toContain(jobNestHCM.id);

      // Match description: 'microservices'
      const resDesc = await jobPostingRepo.searchPublic({
        keyword: 'microservices',
      });
      const idsDesc = resDesc.jobs.map((j) => j.job.id);
      expect(idsDesc).toContain(jobNestHCM.id);
      expect(idsDesc).not.toContain(jobReactHN.id);
    });

    it('2. Filter alone: industry exact match (case-insensitive)', async () => {
      if (!isDbAvailable) return;

      const res = await jobPostingRepo.searchPublic({
        industry: 'FINANCE',
      });
      const ids = res.jobs.map((j) => j.job.id);
      expect(ids).toContain(jobFinanceHN.id);
      expect(ids).not.toContain(jobReactHN.id);
      expect(ids).not.toContain(jobNestHCM.id);
    });

    it('3. Filter alone: city matches branch location (case-insensitive)', async () => {
      if (!isDbAvailable) return;

      // Hà Nội branch
      const resHN = await jobPostingRepo.searchPublic({
        city: 'Hà Nội',
      });
      const idsHN = resHN.jobs.map((j) => j.job.id);
      expect(idsHN).toContain(jobReactHN.id);
      expect(idsHN).toContain(jobFinanceHN.id);
      expect(idsHN).not.toContain(jobNestHCM.id);

      // TP. Hồ Chí Minh branch
      const resHCM = await jobPostingRepo.searchPublic({
        city: 'Hồ Chí Minh',
      });
      const idsHCM = resHCM.jobs.map((j) => j.job.id);
      expect(idsHCM).toContain(jobNestHCM.id);
      expect(idsHCM).toContain(jobMarketingHCM.id);
      expect(idsHCM).not.toContain(jobReactHN.id);
    });

    it('4. Filter alone: type matches job type enum', async () => {
      if (!isDbAvailable) return;

      const resPartTime = await jobPostingRepo.searchPublic({
        type: JobType.PART_TIME,
      });
      const idsPartTime = resPartTime.jobs.map((j) => j.job.id);
      expect(idsPartTime).toContain(jobNestHCM.id);
      expect(idsPartTime).not.toContain(jobReactHN.id);
      expect(idsPartTime).not.toContain(jobFinanceHN.id);

      const resIntern = await jobPostingRepo.searchPublic({
        type: JobType.INTERNSHIP,
      });
      const idsIntern = resIntern.jobs.map((j) => j.job.id);
      expect(idsIntern).toContain(jobFinanceHN.id);
      expect(idsIntern).not.toContain(jobReactHN.id);
    });

    it('5. Filter alone: salary range matches (and includes negotiable salaries)', async () => {
      if (!isDbAvailable) return;

      // salaryMin: 18_000_000 -> jobReactHN (max 25m >= 18m) and jobMarketingHCM (negotiable)
      const resMin = await jobPostingRepo.searchPublic({
        salaryMin: 18000000,
      });
      const idsMin = resMin.jobs.map((j) => j.job.id);
      expect(idsMin).toContain(jobReactHN.id);
      expect(idsMin).toContain(jobMarketingHCM.id);
      expect(idsMin).not.toContain(jobNestHCM.id); // max 12m < 18m
      expect(idsMin).not.toContain(jobFinanceHN.id); // max 6m < 18m

      // salaryMax: 10_000_000 -> jobNestHCM (min 8m <= 10m), jobFinanceHN (min 4m <= 10m), jobMarketingHCM (negotiable)
      const resMax = await jobPostingRepo.searchPublic({
        salaryMax: 10000000,
      });
      const idsMax = resMax.jobs.map((j) => j.job.id);
      expect(idsMax).toContain(jobNestHCM.id);
      expect(idsMax).toContain(jobFinanceHN.id);
      expect(idsMax).toContain(jobMarketingHCM.id);
      expect(idsMax).not.toContain(jobReactHN.id); // min 15m > 10m
    });

    it('6. Filter alone: schedule partial match', async () => {
      if (!isDbAvailable) return;

      const res = await jobPostingRepo.searchPublic({
        schedule: 'Ca tối',
      });
      const ids = res.jobs.map((j) => j.job.id);
      expect(ids).toContain(jobNestHCM.id);
      expect(ids).not.toContain(jobReactHN.id);
      expect(ids).not.toContain(jobFinanceHN.id);
    });

    it('7. Combined filters: returns matching job or empty when conditions conflict', async () => {
      if (!isDbAvailable) return;

      // Combined match
      const resMatch = await jobPostingRepo.searchPublic({
        keyword: 'React',
        industry: 'IT_SOFTWARE',
        city: 'Hà Nội',
        type: JobType.FULL_TIME,
        salaryMin: 10000000,
        salaryMax: 30000000,
        schedule: 'Thứ 2',
      });
      const idsMatch = resMatch.jobs.map((j) => j.job.id);
      expect(idsMatch).toEqual([jobReactHN.id]);

      // Conflicting filters: React developer in HCM
      const resConflict = await jobPostingRepo.searchPublic({
        keyword: 'React',
        city: 'Hồ Chí Minh',
      });
      const idsConflict = resConflict.jobs.map((j) => j.job.id);
      expect(idsConflict).not.toContain(jobReactHN.id);
    });
  });

  describe('F1 - Pagination with equal createdAt (no duplicates or gaps, page-size cap)', () => {
    let equalDateJobs: any[] = [];
    const fixedCreatedAt = new Date('2026-10-25T08:00:00.000Z');

    beforeAll(async () => {
      if (!isDbAvailable) return;

      // Create 5 jobs with identical createdAt timestamp
      for (let i = 1; i <= 5; i++) {
        const job = await prisma.jobPosting.create({
          data: {
            companyId: verifiedCompany.id,
            branchId: branchHN.id,
            title: `EqualTimeJob-${i}-${testRunId}`,
            description: `Description for equal timestamp job ${i}`,
            industry: 'TIMESTAMP_TEST',
            type: JobType.FULL_TIME,
            skills: ['Test'],
            quantity: 1,
            deadline: new Date(Date.now() + 10 * 86400000),
            status: JobStatus.OPEN,
            hiddenByModeration: false,
            createdAt: fixedCreatedAt,
          },
        });
        equalDateJobs.push(job);
      }
    });

    it('paginates deterministically using secondary id desc tie-breaker with no duplicate or missing rows', async () => {
      if (!isDbAvailable) return;

      // Page 1 (limit 2)
      const page1 = await jobPostingRepo.searchPublic({
        industry: 'TIMESTAMP_TEST',
        page: 1,
        limit: 2,
      });
      expect(page1.jobs.length).toBe(2);
      expect(page1.total).toBe(5);

      // Page 2 (limit 2)
      const page2 = await jobPostingRepo.searchPublic({
        industry: 'TIMESTAMP_TEST',
        page: 2,
        limit: 2,
      });
      expect(page2.jobs.length).toBe(2);
      expect(page2.total).toBe(5);

      // Page 3 (limit 2)
      const page3 = await jobPostingRepo.searchPublic({
        industry: 'TIMESTAMP_TEST',
        page: 3,
        limit: 2,
      });
      expect(page3.jobs.length).toBe(1);
      expect(page3.total).toBe(5);

      const allIds = [
        ...page1.jobs.map((j) => j.job.id),
        ...page2.jobs.map((j) => j.job.id),
        ...page3.jobs.map((j) => j.job.id),
      ];

      // Must contain all 5 created jobs with zero duplicates and zero gaps
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(5);
      expect(allIds.length).toBe(5);

      equalDateJobs.forEach((j) => {
        expect(uniqueIds.has(j.id)).toBe(true);
      });

      // Verify deterministic descending ID ordering for identical createdAt
      for (let i = 0; i < allIds.length - 1; i++) {
        expect(allIds[i].localeCompare(allIds[i + 1])).toBeGreaterThan(0);
      }
    });

    it('enforces page-size cap at 50 even if higher limit is requested', async () => {
      if (!isDbAvailable) return;

      const res = await searchPublicJobsUseCase.execute({
        limit: 100, // Exceeds cap
      });

      expect(res.limit).toBe(50);
      expect(res.jobs.length).toBeLessThanOrEqual(50);
    });
  });

  describe('F1 - Exclusion of ineligible jobs in public search and detail', () => {
    it('excludes PENDING_APPROVAL, PAUSED, CLOSED, expired, unverified company, and hidden jobs from searchPublic', async () => {
      if (!isDbAvailable) return;

      const res = await jobPostingRepo.searchPublic({});
      const publicIds = res.jobs.map((j) => j.job.id);

      expect(publicIds).not.toContain(jobPending.id);
      expect(publicIds).not.toContain(jobPaused.id);
      expect(publicIds).not.toContain(jobClosed.id);
      expect(publicIds).not.toContain(jobExpired.id);
      expect(publicIds).not.toContain(jobHidden.id);
      expect(publicIds).not.toContain(jobUnverifiedCompany.id);
    });

    it('findPublicById returns null for PENDING_APPROVAL, PAUSED, CLOSED, unverified company, and hidden jobs', async () => {
      if (!isDbAvailable) return;

      expect(await jobPostingRepo.findPublicById(jobPending.id)).toBeNull();
      expect(await jobPostingRepo.findPublicById(jobPaused.id)).toBeNull();
      expect(await jobPostingRepo.findPublicById(jobClosed.id)).toBeNull();
      expect(await jobPostingRepo.findPublicById(jobHidden.id)).toBeNull();
      expect(await jobPostingRepo.findPublicById(jobUnverifiedCompany.id)).toBeNull();
    });

    it('findPublicById on expired job returns null AND automatically updates status to CLOSED in DB', async () => {
      if (!isDbAvailable) return;

      const result = await jobPostingRepo.findPublicById(jobExpired.id);
      expect(result).toBeNull();

      // Check PostgreSQL DB persistence
      const persisted = await prisma.jobPosting.findUnique({
        where: { id: jobExpired.id },
      });
      expect(persisted?.status).toBe('CLOSED');
    });
  });

  describe('F1 - Company searchPublic and findPublicById (Real DB)', () => {
    it('company searchPublic only returns verified companies and respects filters', async () => {
      if (!isDbAvailable) return;

      const res = await companyRepo.searchPublic({
        keyword: testRunId,
      });
      const companyIds = res.companies.map((c) => c.id);

      expect(companyIds).toContain(verifiedCompany.id);
      expect(companyIds).not.toContain(unverifiedCompany.id);
    });

    it('company findPublicById returns null for unverified companies', async () => {
      if (!isDbAvailable) return;

      const res = await companyRepo.findPublicById(unverifiedCompany.id);
      expect(res).toBeNull();
    });

    it('company findPublicById only returns that company branches and active jobs', async () => {
      if (!isDbAvailable) return;

      const res = await companyRepo.findPublicById(verifiedCompany.id);
      expect(res).not.toBeNull();
      if (!res) return;

      // Branches check: only verifiedCompany branches
      const branchIds = res.branches.map((b) => b.id);
      expect(branchIds).toContain(branchHN.id);
      expect(branchIds).toContain(branchHCM.id);
      expect(branchIds).not.toContain(branchUnv.id);

      // Jobs check: only OPEN, non-expired, non-hidden jobs of verifiedCompany
      const activeJobIds = res.activeJobs.map((j) => j.id);
      expect(activeJobIds).toContain(jobReactHN.id);
      expect(activeJobIds).toContain(jobNestHCM.id);
      expect(activeJobIds).toContain(jobFinanceHN.id);
      expect(activeJobIds).toContain(jobMarketingHCM.id);

      // Ineligible jobs must NOT be present
      expect(activeJobIds).not.toContain(jobPending.id);
      expect(activeJobIds).not.toContain(jobPaused.id);
      expect(activeJobIds).not.toContain(jobClosed.id);
      expect(activeJobIds).not.toContain(jobExpired.id);
      expect(activeJobIds).not.toContain(jobHidden.id);
      expect(activeJobIds).not.toContain(jobUnverifiedCompany.id);
    });
  });

  describe('F1 - Data Sanitization / Exclusion of Private Fields in Public DTOs', () => {
    it('public job DTOs contain none of rejectionReason, rejectedAt, or hiddenByModeration', async () => {
      if (!isDbAvailable) return;

      const jobList = await searchPublicJobsUseCase.execute({ keyword: testRunId });
      expect(jobList.jobs.length).toBeGreaterThan(0);

      jobList.jobs.forEach((dto) => {
        expect((dto as any).rejectionReason).toBeUndefined();
        expect((dto as any).rejectedAt).toBeUndefined();
        expect((dto as any).hiddenByModeration).toBeUndefined();
      });

      const singleJob = await getPublicJobDetailUseCase.execute(jobReactHN.id);
      expect((singleJob.job as any).rejectionReason).toBeUndefined();
      expect((singleJob.job as any).rejectedAt).toBeUndefined();
      expect((singleJob.job as any).hiddenByModeration).toBeUndefined();
    });

    it('public company DTOs contain none of taxId, license/legal documents, or member emails', async () => {
      if (!isDbAvailable) return;

      const companyList = await searchPublicCompaniesUseCase.execute({ keyword: testRunId });
      expect(companyList.companies.length).toBeGreaterThan(0);

      companyList.companies.forEach((dto) => {
        expect((dto as any).taxId).toBeUndefined();
        expect((dto as any).documents).toBeUndefined();
        expect((dto as any).members).toBeUndefined();
      });

      const singleCompany = await getPublicCompanyDetailUseCase.execute(verifiedCompany.id);
      const companyDto = singleCompany.company;

      expect((companyDto as any).taxId).toBeUndefined();
      expect((companyDto as any).documents).toBeUndefined();
      expect((companyDto as any).members).toBeUndefined();

      // Ensure branch public DTOs do not leak member/private emails
      companyDto.branches.forEach((b: any) => {
        expect(b.email).toBeUndefined();
      });
    });
  });

  // ==========================================================================
  // F3: JobAccessSource through Production Module Graph (Real PostgreSQL)
  // ==========================================================================
  describe('F3 - JobAccessSource through Production Module Graph (Real DB)', () => {
    it('1. Ineligible: PENDING_APPROVAL job throws M04WorkflowError(INVALID_STATE)', async () => {
      if (!isDbAvailable) return;

      await expect(
        jobAccessSource.assertAcceptingApplications(jobPending.id),
      ).rejects.toThrow(new M04WorkflowError('INVALID_STATE'));
    });

    it('2. Ineligible: PAUSED job throws M04WorkflowError(INVALID_STATE)', async () => {
      if (!isDbAvailable) return;

      await expect(
        jobAccessSource.assertAcceptingApplications(jobPaused.id),
      ).rejects.toThrow(new M04WorkflowError('INVALID_STATE'));
    });

    it('3. Ineligible: CLOSED job throws M04WorkflowError(INVALID_STATE)', async () => {
      if (!isDbAvailable) return;

      await expect(
        jobAccessSource.assertAcceptingApplications(jobClosed.id),
      ).rejects.toThrow(new M04WorkflowError('INVALID_STATE'));
    });

    it('4. Ineligible: Expired job throws M04WorkflowError(INVALID_STATE) and persists CLOSED in DB', async () => {
      if (!isDbAvailable) return;

      // Create a fresh open job that is already expired
      const freshlyExpiredJob = await jobPostingRepo.create({
        companyId: verifiedCompany.id,
        branchId: branchHN.id,
        title: `Fresh Expired ${testRunId}`,
        description: 'Expired test job',
        industry: 'IT_SOFTWARE',
        type: JobType.FULL_TIME,
        skills: ['Skills'],
        quantity: 1,
        deadline: new Date(Date.now() - 10000), // Expired 10 seconds ago
        status: JobStatus.OPEN,
      });

      await expect(
        jobAccessSource.assertAcceptingApplications(freshlyExpiredJob.id),
      ).rejects.toThrow(new M04WorkflowError('INVALID_STATE'));

      // Verify PostgreSQL auto-closed status
      const dbRow = await prisma.jobPosting.findUnique({
        where: { id: freshlyExpiredJob.id },
      });
      expect(dbRow?.status).toBe('CLOSED');
    });

    it('5. Ineligible: hiddenByModeration=true job throws M04WorkflowError(INVALID_STATE)', async () => {
      if (!isDbAvailable) return;

      // Create OPEN job with hiddenByModeration=true
      const hiddenOpenJob = await jobPostingRepo.create({
        companyId: verifiedCompany.id,
        branchId: branchHN.id,
        title: `Hidden Open ${testRunId}`,
        description: 'Hidden by moderation',
        industry: 'IT_SOFTWARE',
        type: JobType.FULL_TIME,
        skills: ['Skills'],
        quantity: 1,
        deadline: new Date(Date.now() + 86400000),
        status: JobStatus.OPEN,
        hiddenByModeration: true,
      });

      await expect(
        jobAccessSource.assertAcceptingApplications(hiddenOpenJob.id),
      ).rejects.toThrow(new M04WorkflowError('INVALID_STATE'));
    });

    it('6. Ineligible: job of unverified company throws M04WorkflowError(INVALID_STATE)', async () => {
      if (!isDbAvailable) return;

      await expect(
        jobAccessSource.assertAcceptingApplications(jobUnverifiedCompany.id),
      ).rejects.toThrow(new M04WorkflowError('INVALID_STATE'));
    });

    it('7. Ineligible: job with branch belonging to another company throws M04WorkflowError(INVALID_STATE)', async () => {
      if (!isDbAvailable) return;

      // Note: PostgreSQL composite foreign key rejects inserting mismatched companyId/branchId at DB level.
      // We simulate cross-company branch resolution in repository adapter to assert the invariant guard.
      const branchRepoInstance = moduleFixture.get(COMPANY_BRANCH_REPOSITORY_TOKEN);
      const spy = jest.spyOn(branchRepoInstance, 'findById').mockResolvedValueOnce({
        id: branchHN.id,
        companyId: 'mismatched-other-company-id',
      } as any);

      await expect(
        jobAccessSource.assertAcceptingApplications(jobReactHN.id),
      ).rejects.toThrow(new M04WorkflowError('INVALID_STATE'));

      spy.mockRestore();
    });

    it('8. Eligible: OPEN job with valid company and branch resolves successfully', async () => {
      if (!isDbAvailable) return;

      await expect(
        jobAccessSource.assertAcceptingApplications(jobReactHN.id),
      ).resolves.toBeUndefined();

      const adapter = jobAccessSource as JobAccessSourceAdapter;
      const eligibility = await adapter.getEligibility(jobReactHN.id);
      expect(eligibility).toEqual({
        jobId: jobReactHN.id,
        companyId: verifiedCompany.id,
        companyName: verifiedCompany.name,
        branchId: branchHN.id,
        title: jobReactHN.title,
        status: JobStatus.OPEN,
        deadline: jobReactHN.deadline.toISOString(),
        quantity: 2,
        acceptingApplications: true,
      });
    });

    it('9. assertManagedBy verifies active company membership', async () => {
      if (!isDbAvailable) return;

      // Owner/active member succeeds
      await expect(
        jobAccessSource.assertManagedBy(jobReactHN.id, employerUser.id),
      ).resolves.toBeUndefined();

      // Other non-member user throws FORBIDDEN
      await expect(
        jobAccessSource.assertManagedBy(jobReactHN.id, otherUser.id),
      ).rejects.toThrow(new M04WorkflowError('FORBIDDEN'));
    });
  });
});
