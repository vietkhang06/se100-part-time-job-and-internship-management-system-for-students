import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { GlobalExceptionFilter } from '../src/shared/filters/http-exception.filter';
import {
  UserRole,
  UserStatus,
  CompanyVerificationStatus,
  CompanyMemberRole,
  CompanyMemberStatus,
  JobStatus,
  JobType,
} from '@campusjob/contracts';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';

const request = supertest;

describe('M03 Session 4 Routes & RBAC Auth Guards (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const runId = Date.now().toString(36);
  const password = 'Password@123';

  let studentToken: string;
  let employer1Token: string;
  let employer2Token: string;
  let adminToken: string;

  let studentUserId: string;
  let employer1UserId: string;
  let employer2UserId: string;
  let adminUserId: string;

  let company1Id: string;
  let company2Id: string;
  let branch1Id: string;
  let branch2Id: string;
  let job1Id: string;
  let job2Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await PasswordHasher.hash(password);

    // 1. Create Users
    studentUserId = `usr-std-${runId}`;
    employer1UserId = `usr-emp1-${runId}`;
    employer2UserId = `usr-emp2-${runId}`;
    adminUserId = `usr-adm-${runId}`;

    await prisma.user.createMany({
      data: [
        {
          id: studentUserId,
          email: `student-${runId}@campusjob.local`,
          fullName: 'Student User',
          passwordHash,
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
        {
          id: employer1UserId,
          email: `employer1-${runId}@company1.com`,
          fullName: 'Employer One',
          passwordHash,
          role: UserRole.EMPLOYER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
        {
          id: employer2UserId,
          email: `employer2-${runId}@company2.com`,
          fullName: 'Employer Two',
          passwordHash,
          role: UserRole.EMPLOYER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
        {
          id: adminUserId,
          email: `admin-${runId}@campusjob.local`,
          fullName: 'Admin User',
          passwordHash,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      ],
    });

    // 2. Login users to get real JWT access tokens
    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      return res.body.accessToken;
    };

    studentToken = await login(`student-${runId}@campusjob.local`);
    employer1Token = await login(`employer1-${runId}@company1.com`);
    employer2Token = await login(`employer2-${runId}@company2.com`);
    adminToken = await login(`admin-${runId}@campusjob.local`);

    // 3. Create Companies and Members
    company1Id = `cmp1-${runId}`;
    company2Id = `cmp2-${runId}`;

    await prisma.company.create({
      data: {
        id: company1Id,
        name: `Company 1 ${runId}`,
        taxId: `TAX1-${runId}`,
        verificationStatus: CompanyVerificationStatus.VERIFIED,
      },
    });

    await prisma.company.create({
      data: {
        id: company2Id,
        name: `Company 2 ${runId}`,
        taxId: `TAX2-${runId}`,
        verificationStatus: CompanyVerificationStatus.VERIFIED,
      },
    });

    await prisma.companyMember.createMany({
      data: [
        {
          id: `cm1-${runId}`,
          companyId: company1Id,
          userId: employer1UserId,
          role: CompanyMemberRole.OWNER,
          status: CompanyMemberStatus.ACTIVE,
        },
        {
          id: `cm2-${runId}`,
          companyId: company2Id,
          userId: employer2UserId,
          role: CompanyMemberRole.OWNER,
          status: CompanyMemberStatus.ACTIVE,
        },
      ],
    });

    // 4. Create Branches
    branch1Id = `br1-${runId}`;
    branch2Id = `br2-${runId}`;

    await prisma.companyBranch.createMany({
      data: [
        {
          id: branch1Id,
          companyId: company1Id,
          branchName: 'Branch 1',
          addressLine: '123 St',
          city: 'Ho Chi Minh',
          country: 'Vietnam',
          isHeadquarter: true,
        },
        {
          id: branch2Id,
          companyId: company2Id,
          branchName: 'Branch 2',
          addressLine: '456 St',
          city: 'Hanoi',
          country: 'Vietnam',
          isHeadquarter: true,
        },
      ],
    });

    // 5. Create Job Postings
    job1Id = `job1-${runId}`;
    job2Id = `job2-${runId}`;

    const future = new Date(Date.now() + 10 * 24 * 3600 * 1000);

    await prisma.jobPosting.createMany({
      data: [
        {
          id: job1Id,
          companyId: company1Id,
          branchId: branch1Id,
          title: 'Software Engineer Co 1',
          description: 'Job 1 description',
          industry: 'IT',
          type: JobType.FULL_TIME,
          skills: ['NodeJS'],
          quantity: 2,
          isSalaryNegotiable: true,
          deadline: future,
          status: JobStatus.OPEN,
          viewCount: 5,
        },
        {
          id: job2Id,
          companyId: company2Id,
          branchId: branch2Id,
          title: 'Software Engineer Co 2',
          description: 'Job 2 description',
          industry: 'IT',
          type: JobType.FULL_TIME,
          skills: ['React'],
          quantity: 1,
          isSalaryNegotiable: true,
          deadline: future,
          status: JobStatus.OPEN,
          viewCount: 10,
        },
      ],
    });
  });

  afterAll(async () => {
    try {
      await prisma.jobViewLog.deleteMany({
        where: { jobId: { in: [job1Id, job2Id] } },
      });
      await prisma.savedJob.deleteMany({
        where: { studentId: studentUserId },
      });
      await prisma.jobPosting.deleteMany({
        where: { id: { in: [job1Id, job2Id] } },
      });
      await prisma.companyBranch.deleteMany({
        where: { id: { in: [branch1Id, branch2Id] } },
      });
      await prisma.companyMember.deleteMany({
        where: { companyId: { in: [company1Id, company2Id] } },
      });
      await prisma.company.deleteMany({
        where: { id: { in: [company1Id, company2Id] } },
      });
      await prisma.authSession.deleteMany({
        where: { userId: { in: [studentUserId, employer1UserId, employer2UserId, adminUserId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [studentUserId, employer1UserId, employer2UserId, adminUserId] } },
      });
    } catch (e) {
      console.warn('Cleanup error:', e);
    } finally {
      if (app) await app.close();
    }
  });

  describe('1. Saved-Jobs Endpoints RBAC (Student only)', () => {
    it('GET /api/v1/student/saved-jobs không có token trả về 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/student/saved-jobs')
        .expect(401);
    });

    it('GET /api/v1/student/saved-jobs với role EMPLOYER trả về 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/student/saved-jobs')
        .set('Authorization', `Bearer ${employer1Token}`)
        .expect(403);
    });

    it('GET /api/v1/student/saved-jobs với role ADMIN trả về 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/student/saved-jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('GET /api/v1/student/saved-jobs với role STUDENT trả về 200 OK', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/student/saved-jobs')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.savedJobs).toBeDefined();
      expect(Array.isArray(res.body.savedJobs)).toBe(true);
    });

    it('POST /api/v1/student/saved-jobs/:id không có token trả về 401', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/student/saved-jobs/${job1Id}`)
        .expect(401);
    });

    it('POST /api/v1/student/saved-jobs/:id với role EMPLOYER trả về 403', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/student/saved-jobs/${job1Id}`)
        .set('Authorization', `Bearer ${employer1Token}`)
        .expect(403);
    });

    it('POST /api/v1/student/saved-jobs/:id với role STUDENT trả về 200 OK (idempotent)', async () => {
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/student/saved-jobs/${job1Id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res1.body.saved).toBe(true);

      // Lưu lần 2: vẫn trả 200 và saved: true
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/student/saved-jobs/${job1Id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res2.body.saved).toBe(true);
    });

    it('GET /api/v1/student/saved-jobs/ids với role STUDENT trả về 200 chứa jobId đã lưu', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/student/saved-jobs/ids')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.jobIds).toContain(job1Id);
    });

    it('DELETE /api/v1/student/saved-jobs/:id với role STUDENT bỏ lưu thành công', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/student/saved-jobs/${job1Id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.saved).toBe(false);
    });
  });

  describe('2. Employer Metrics Only for Own Company', () => {
    it('Employer 1 xem job 1 (thuộc công ty 1 của mình) -> 200 OK có saveCount và viewCount', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employer/jobs/${job1Id}`)
        .set('Authorization', `Bearer ${employer1Token}`)
        .expect(200);

      expect(res.body.job).toBeDefined();
      expect(res.body.job.id).toBe(job1Id);
      expect(res.body.job.viewCount).toBeDefined();
      expect(typeof res.body.job.viewCount).toBe('number');
      expect(res.body.job.saveCount).toBeDefined();
      expect(typeof res.body.job.saveCount).toBe('number');
    });

    it('Employer 2 xem job 1 (thuộc công ty 1 của người khác) -> 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/employer/jobs/${job1Id}`)
        .set('Authorization', `Bearer ${employer2Token}`)
        .expect(403);
    });

    it('Anonymous xem /employer/jobs/:id -> 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/employer/jobs/${job1Id}`)
        .expect(401);
    });
  });

  describe('3. Admin Metrics Admin-Only', () => {
    it('Anonymous xem metrics tổng hợp -> 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/jobs/metrics')
        .expect(401);
    });

    it('Student xem metrics tổng hợp -> 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/jobs/metrics')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    it('Employer xem metrics tổng hợp -> 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/jobs/metrics')
        .set('Authorization', `Bearer ${employer1Token}`)
        .expect(403);
    });

    it('Admin xem metrics tổng hợp -> 200 OK', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/jobs/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.totalJobs).toBeDefined();
      expect(res.body.totalViews).toBeDefined();
      expect(res.body.totalSaves).toBeDefined();
      expect(Array.isArray(res.body.jobs)).toBe(true);
    });

    it('Admin xem metrics của 1 tin cụ thể -> 200 OK', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/jobs/${job1Id}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.jobId).toBe(job1Id);
      expect(res.body.viewCount).toBeDefined();
      expect(res.body.saveCount).toBeDefined();
    });
  });

  describe('4. Public DTOs Without viewCount / saveCount', () => {
    it('GET /api/v1/jobs (public search) không chứa viewCount hay saveCount', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/jobs')
        .expect(200);

      expect(res.body.jobs).toBeDefined();
      expect(res.body.jobs.length).toBeGreaterThan(0);

      for (const job of res.body.jobs) {
        expect(job.viewCount).toBeUndefined();
        expect(job.saveCount).toBeUndefined();
      }
    });

    it('GET /api/v1/jobs/:id (public detail) không chứa viewCount hay saveCount', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${job1Id}`)
        .expect(200);

      expect(res.body.job).toBeDefined();
      expect(res.body.job.id).toBe(job1Id);
      expect(res.body.job.viewCount).toBeUndefined();
      expect(res.body.job.saveCount).toBeUndefined();
    });
  });
});
