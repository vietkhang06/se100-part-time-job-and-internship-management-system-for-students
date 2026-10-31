import { PrismaClient } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CompanyVerificationStatus,
  CompanyMemberRole,
  CompanyMemberStatus,
  JobType,
  JobStatus,
  UserRole,
  UserStatus,
} from '@campusjob/contracts';
import { AppModule } from '../../../../app.module';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';
import {
  ISavedJobRepository,
  SAVED_JOB_REPOSITORY_TOKEN,
} from '../../domain/repositories/saved-job.repository.interface';
import { SaveJobUseCase } from '../../application/use-cases/save-job.use-case';
import { UnsaveJobUseCase } from '../../application/use-cases/unsave-job.use-case';
import { ListSavedJobsUseCase } from '../../application/use-cases/list-saved-jobs.use-case';
import { GetSavedJobIdsUseCase } from '../../application/use-cases/get-saved-job-ids.use-case';
import { GetPublicJobDetailUseCase } from '../../application/use-cases/get-public-job-detail.use-case';
import { GetAdminJobMetricsUseCase } from '../../application/use-cases/get-admin-job-metrics.use-case';
import { JobExpirySchedulerService } from '../../application/services/job-expiry-scheduler.service';
import {
  IJobExpiryNotifier,
  JOB_EXPIRY_NOTIFIER_TOKEN,
} from '../../domain/ports/job-expiry-notifier.port';

const databaseUrl =
  process.env.SCRATCH_DATABASE_URL ||
  'postgresql://campusjob:campusjob_dev@localhost:5435/campusjob_m03_scratch?schema=public';

process.env.DATABASE_URL = databaseUrl;

describe('Prisma Saved Jobs, Metrics & Expiry Scheduler (Real Scratch DB Integration)', () => {
  let prisma: PrismaClient;
  let moduleRef: TestingModule;
  let isDbAvailable = false;

  let jobRepo: IJobPostingRepository;
  let savedJobRepo: ISavedJobRepository;
  let saveJobUseCase: SaveJobUseCase;
  let unsaveJobUseCase: UnsaveJobUseCase;
  let listSavedJobsUseCase: ListSavedJobsUseCase;
  let getSavedJobIdsUseCase: GetSavedJobIdsUseCase;
  let getPublicJobDetailUseCase: GetPublicJobDetailUseCase;
  let getAdminJobMetricsUseCase: GetAdminJobMetricsUseCase;
  let schedulerService: JobExpirySchedulerService;

  const testRunId = Date.now().toString(36);
  let studentAId: string;
  let studentBId: string;
  let ownerUserId: string;
  let companyId: string;
  let branchId: string;

  let publicJobId: string;
  let expiredJobId: string;
  let closedJobId: string;
  let expiringSoonJobId: string;

  const mockNotifier: IJobExpiryNotifier = {
    sendExpiryReminder: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });

    try {
      await prisma.$connect();
      await prisma.$executeRaw`SELECT 1 FROM "User" LIMIT 1`;
      isDbAvailable = true;
    } catch (err: any) {
      console.warn('Postgres scratch DB not reachable, skipping integration test:', err.message);
      return;
    }

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(JOB_EXPIRY_NOTIFIER_TOKEN)
      .useValue(mockNotifier)
      .compile();

    jobRepo = moduleRef.get<IJobPostingRepository>(JOB_POSTING_REPOSITORY_TOKEN);
    savedJobRepo = moduleRef.get<ISavedJobRepository>(SAVED_JOB_REPOSITORY_TOKEN);
    saveJobUseCase = moduleRef.get<SaveJobUseCase>(SaveJobUseCase);
    unsaveJobUseCase = moduleRef.get<UnsaveJobUseCase>(UnsaveJobUseCase);
    listSavedJobsUseCase = moduleRef.get<ListSavedJobsUseCase>(ListSavedJobsUseCase);
    getSavedJobIdsUseCase = moduleRef.get<GetSavedJobIdsUseCase>(GetSavedJobIdsUseCase);
    getPublicJobDetailUseCase = moduleRef.get<GetPublicJobDetailUseCase>(GetPublicJobDetailUseCase);
    getAdminJobMetricsUseCase = moduleRef.get<GetAdminJobMetricsUseCase>(GetAdminJobMetricsUseCase);
    schedulerService = moduleRef.get<JobExpirySchedulerService>(JobExpirySchedulerService);

    // 1. Create Users
    studentAId = `user-std-a-${testRunId}`;
    studentBId = `user-std-b-${testRunId}`;
    ownerUserId = `user-emp-owner-${testRunId}`;

    await prisma.user.createMany({
      data: [
        {
          id: studentAId,
          email: `stda-${testRunId}@example.com`,
          fullName: 'Student A',
          passwordHash: 'hash',
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
        },
        {
          id: studentBId,
          email: `stdb-${testRunId}@example.com`,
          fullName: 'Student B',
          passwordHash: 'hash',
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
        },
        {
          id: ownerUserId,
          email: `owner-${testRunId}@company.com`,
          fullName: 'Company Owner',
          passwordHash: 'hash',
          role: UserRole.EMPLOYER,
          status: UserStatus.ACTIVE,
        },
      ],
    });

    // 2. Create Company & Branch
    companyId = `comp-${testRunId}`;
    branchId = `branch-${testRunId}`;

    await prisma.company.create({
      data: {
        id: companyId,
        name: `Integration Test Co ${testRunId}`,
        taxId: `TAX-S4-${testRunId}`,
        verificationStatus: CompanyVerificationStatus.VERIFIED,
      },
    });

    await prisma.companyMember.create({
      data: {
        id: `cm-${testRunId}`,
        companyId,
        userId: ownerUserId,
        role: CompanyMemberRole.OWNER,
        status: CompanyMemberStatus.ACTIVE,
      },
    });

    await prisma.companyBranch.create({
      data: {
        id: branchId,
        companyId,
        branchName: 'Headquarter',
        addressLine: '123 Street',
        city: 'Ho Chi Minh',
        country: 'Vietnam',
        isHeadquarter: true,
      },
    });

    // 3. Create Jobs
    publicJobId = `job-pub-${testRunId}`;
    expiredJobId = `job-exp-${testRunId}`;
    closedJobId = `job-cls-${testRunId}`;
    expiringSoonJobId = `job-soon-${testRunId}`;

    const futureDate = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    const pastDate = new Date(Date.now() - 2 * 3600 * 1000);
    const soonDate = new Date(Date.now() + 2 * 24 * 3600 * 1000); // 2 days

    await prisma.jobPosting.createMany({
      data: [
        {
          id: publicJobId,
          companyId,
          branchId,
          title: 'Full Stack Engineer',
          description: 'Great job',
          industry: 'IT',
          type: JobType.FULL_TIME,
          skills: ['Node', 'React'],
          quantity: 2,
          isSalaryNegotiable: true,
          deadline: futureDate,
          status: JobStatus.OPEN,
          viewCount: 0,
        },
        {
          id: expiredJobId,
          companyId,
          branchId,
          title: 'Past Expired Job',
          description: 'Expired position',
          industry: 'IT',
          type: JobType.PART_TIME,
          skills: ['JS'],
          quantity: 1,
          isSalaryNegotiable: true,
          deadline: pastDate,
          status: JobStatus.OPEN, // Still OPEN in DB, scheduler should close it!
          viewCount: 0,
        },
        {
          id: closedJobId,
          companyId,
          branchId,
          title: 'Manually Closed Job',
          description: 'Closed',
          industry: 'IT',
          type: JobType.PART_TIME,
          skills: ['JS'],
          quantity: 1,
          isSalaryNegotiable: true,
          deadline: futureDate,
          status: JobStatus.CLOSED,
          viewCount: 0,
        },
        {
          id: expiringSoonJobId,
          companyId,
          branchId,
          title: 'Expiring Soon Job',
          description: 'Expiring within 3 days',
          industry: 'IT',
          type: JobType.FULL_TIME,
          skills: ['TS'],
          quantity: 1,
          isSalaryNegotiable: true,
          deadline: soonDate,
          status: JobStatus.OPEN,
          viewCount: 0,
        },
      ],
    });
  });

  afterAll(async () => {
    if (!isDbAvailable) return;
    try {
      await prisma.jobViewLog.deleteMany({
        where: { jobId: { in: [publicJobId, expiredJobId, closedJobId, expiringSoonJobId] } },
      });
      await prisma.jobExpiryReminderLog.deleteMany({
        where: { jobId: { in: [publicJobId, expiredJobId, closedJobId, expiringSoonJobId] } },
      });
      await prisma.savedJob.deleteMany({
        where: { studentId: { in: [studentAId, studentBId] } },
      });
      await prisma.jobPosting.deleteMany({
        where: { companyId },
      });
      await prisma.companyBranch.deleteMany({
        where: { companyId },
      });
      await prisma.companyMember.deleteMany({
        where: { companyId },
      });
      await prisma.company.deleteMany({
        where: { id: companyId },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [studentAId, studentBId, ownerUserId] } },
      });
    } catch (e) {
      console.warn('Cleanup error:', e);
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('1. SavedJob (S3-M03-03, S5-M03-05)', () => {
    it('lưu tin công khai thành công và có tính idempotent (lưu 2 lần không tạo duplicate row)', async () => {
      if (!isDbAvailable) return;

      const res1 = await saveJobUseCase.execute(studentAId, publicJobId);
      expect(res1.saved).toBe(true);

      const res2 = await saveJobUseCase.execute(studentAId, publicJobId);
      expect(res2.saved).toBe(true);

      const count = await prisma.savedJob.count({
        where: { studentId: studentAId, jobId: publicJobId },
      });
      expect(count).toBe(1);
    });

    it('sinh viên A và B hoàn toàn độc lập; bỏ lưu chỉ tác động tới sinh viên hiện tại', async () => {
      if (!isDbAvailable) return;

      // Sinh viên B cũng lưu tin
      await saveJobUseCase.execute(studentBId, publicJobId);

      // Sinh viên A bỏ lưu
      const unsaveRes = await unsaveJobUseCase.execute(studentAId, publicJobId);
      expect(unsaveRes.saved).toBe(false);

      // Sinh viên A không còn lưu
      const countA = await prisma.savedJob.count({
        where: { studentId: studentAId, jobId: publicJobId },
      });
      expect(countA).toBe(0);

      // Sinh viên B vẫn còn lưu
      const countB = await prisma.savedJob.count({
        where: { studentId: studentBId, jobId: publicJobId },
      });
      expect(countB).toBe(1);
    });

    it('không cho phép lưu tin không đủ điều kiện công khai (CLOSED hoặc EXPIRED)', async () => {
      if (!isDbAvailable) return;

      await expect(saveJobUseCase.execute(studentAId, closedJobId)).rejects.toThrow();
      await expect(saveJobUseCase.execute(studentAId, expiredJobId)).rejects.toThrow();
    });

    it('danh sách đã lưu phân trang ổn định và cung cấp endpoint IDs', async () => {
      if (!isDbAvailable) return;

      // Lưu lại cho A
      await saveJobUseCase.execute(studentAId, publicJobId);

      const ids = await getSavedJobIdsUseCase.execute(studentAId);
      expect(ids.jobIds).toContain(publicJobId);

      const list = await listSavedJobsUseCase.execute(studentAId, { page: 1, limit: 10 });
      expect(list.total).toBeGreaterThanOrEqual(1);
      expect(list.savedJobs[0].job?.id).toBe(publicJobId);
      expect(list.savedJobs[0].isAvailable).toBe(true);
    });
  });

  describe('2. Job Metrics & Deduplication (S6-M03-01)', () => {
    it('lần xem đầu tiên tăng viewCount; refresh trong cùng ngày không tăng tiếp (dedupe theo calendar day)', async () => {
      if (!isDbAvailable) return;

      const viewerKey = `anon:test-visitor-${testRunId}`;

      // View 1
      await getPublicJobDetailUseCase.execute(publicJobId, { viewerKey });
      const jobAfter1 = await prisma.jobPosting.findUnique({ where: { id: publicJobId } });
      const views1 = jobAfter1?.viewCount ?? 0;

      // Refresh (View 2 cùng ngày)
      await getPublicJobDetailUseCase.execute(publicJobId, { viewerKey });
      const jobAfter2 = await prisma.jobPosting.findUnique({ where: { id: publicJobId } });
      const views2 = jobAfter2?.viewCount ?? 0;

      expect(views2).toBe(views1);
    });

    it('người xem khác (viewerKey khác) được tính thêm 1 lượt xem', async () => {
      if (!isDbAvailable) return;

      const viewerKey1 = `anon:visitor-x-${testRunId}`;
      const viewerKey2 = `anon:visitor-y-${testRunId}`;

      const jobBefore = await prisma.jobPosting.findUnique({ where: { id: publicJobId } });
      const initialViews = jobBefore?.viewCount ?? 0;

      await getPublicJobDetailUseCase.execute(publicJobId, { viewerKey: viewerKey1 });
      await getPublicJobDetailUseCase.execute(publicJobId, { viewerKey: viewerKey2 });

      const jobAfter = await prisma.jobPosting.findUnique({ where: { id: publicJobId } });
      expect(jobAfter?.viewCount).toBe(initialViews + 2);
    });

    it('lượt xem từ Owner của doanh nghiệp không bao giờ được tính (Owner view exclusion)', async () => {
      if (!isDbAvailable) return;

      const jobBefore = await prisma.jobPosting.findUnique({ where: { id: publicJobId } });
      const initialViews = jobBefore?.viewCount ?? 0;

      // Owner xem tin của công ty mình
      await getPublicJobDetailUseCase.execute(publicJobId, {
        userId: ownerUserId,
        viewerKey: `user:${ownerUserId}`,
      });

      const jobAfter = await prisma.jobPosting.findUnique({ where: { id: publicJobId } });
      expect(jobAfter?.viewCount).toBe(initialViews);
    });

    it('PublicJobPostingDto không chứa viewCount hay saveCount; Admin metrics trả về đúng', async () => {
      if (!isDbAvailable) return;

      const publicDto = await getPublicJobDetailUseCase.execute(publicJobId, {
        viewerKey: `anon:public-check-${testRunId}`,
      });

      expect((publicDto.job as any).viewCount).toBeUndefined();
      expect((publicDto.job as any).saveCount).toBeUndefined();

      const adminMetrics = await getAdminJobMetricsUseCase.executeSingle(publicJobId);
      expect(adminMetrics.jobId).toBe(publicJobId);
      expect(adminMetrics.viewCount).toBeGreaterThanOrEqual(1);
      expect(adminMetrics.saveCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Job Expiry Scheduler (S6-M03-02)', () => {
    it('Step 1: tự động đóng các tin hết hạn trong DB và không đụng vào tin chưa hết hạn', async () => {
      if (!isDbAvailable) return;

      const freshExpiredId = `job-fresh-exp-${testRunId}`;
      await prisma.jobPosting.create({
        data: {
          id: freshExpiredId,
          companyId,
          branchId,
          title: 'Fresh Expired Job',
          description: 'Expired position created right before scheduler',
          industry: 'IT',
          type: JobType.PART_TIME,
          skills: ['JS'],
          quantity: 1,
          isSalaryNegotiable: true,
          deadline: new Date(Date.now() - 3600 * 1000),
          status: JobStatus.OPEN,
          viewCount: 0,
        },
      });

      // Trước khi chạy: freshExpiredId đang là OPEN
      const before = await prisma.jobPosting.findUnique({ where: { id: freshExpiredId } });
      expect(before?.status).toBe(JobStatus.OPEN);

      const runResult = await schedulerService.runJobExpiryCheck();
      expect(runResult.closedCount).toBeGreaterThanOrEqual(1);

      // Sau khi chạy: freshExpiredId đã chuyển sang CLOSED
      const afterExpired = await prisma.jobPosting.findUnique({ where: { id: freshExpiredId } });
      expect(afterExpired?.status).toBe(JobStatus.CLOSED);

      // Tin publicJobId (chưa hết hạn) vẫn OPEN
      const afterPublic = await prisma.jobPosting.findUnique({ where: { id: publicJobId } });
      expect(afterPublic?.status).toBe(JobStatus.OPEN);

      // Cleanup
      await prisma.jobPosting.delete({ where: { id: freshExpiredId } });
    });

    it('Step 2: gửi email nhắc nhở cho tin sắp hết hạn trong 3 ngày, lần 2 không gửi lại (dedupe)', async () => {
      if (!isDbAvailable) return;

      const freshSoonId = `job-fresh-soon-${testRunId}`;
      await prisma.jobPosting.create({
        data: {
          id: freshSoonId,
          companyId,
          branchId,
          title: 'Fresh Soon Job',
          description: 'Expiring in 2 days',
          industry: 'IT',
          type: JobType.FULL_TIME,
          skills: ['TS'],
          quantity: 1,
          isSalaryNegotiable: true,
          deadline: new Date(Date.now() + 2 * 24 * 3600 * 1000),
          status: JobStatus.OPEN,
          viewCount: 0,
        },
      });

      const run1 = await schedulerService.runJobExpiryCheck();
      expect(run1.remindersSent).toBeGreaterThanOrEqual(1);

      // Chạy lần 2: không gửi lại email trùng
      const run2 = await schedulerService.runJobExpiryCheck();
      expect(run2.remindersSent).toBe(0);

      // Cleanup
      await prisma.jobExpiryReminderLog.deleteMany({ where: { jobId: freshSoonId } });
      await prisma.jobPosting.delete({ where: { id: freshSoonId } });
    });
  });
});
