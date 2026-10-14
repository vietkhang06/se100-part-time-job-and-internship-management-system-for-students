import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { DatabaseModule } from '../src/shared/database/database.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';
import { GlobalExceptionFilter } from '../src/shared/filters/http-exception.filter';
import {
  AuthErrorCode,
  CvErrorCode,
  CvSnapshotDto,
  UserRole,
  UserStatus,
} from '@campusjob/contracts';
import { M04Controller } from '../src/modules/applications/presentation/m04.controller';
import { M04Workflow } from '../src/modules/applications/application/m04-workflow';
import { PrismaM04Repository } from '../src/modules/applications/infrastructure/prisma-m04.repository';
import {
  CvSnapshotSource,
  JobAccessSource,
  M04WorkflowError,
} from '../src/modules/applications/application/m04-ports';
import { RolesGuard } from '../src/shared/guards/roles.guard';

const request = (typeof supertest === 'function' ? supertest : (supertest as any).default) as typeof supertest;

describe('S2-M01-05: Cross-Module Authorization (E2E & Contract Tests)', () => {
  let app: INestApplication;
  let m04App: INestApplication;
  let prisma: PrismaService;

  const defaultPassword = 'StrongPassword123!@#';

  // Test accounts
  const accounts = {
    studentA: {
      id: '',
      email: 'cma-student-a@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      token: '',
      profileId: '',
      cvId: '',
    },
    studentB: {
      id: '',
      email: 'cma-student-b@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      token: '',
      profileId: '',
      cvId: '',
    },
    employerA: {
      id: '',
      email: 'cma-employer-a@campusjob.local',
      role: UserRole.EMPLOYER,
      status: UserStatus.ACTIVE,
      token: '',
    },
    employerB: {
      id: '',
      email: 'cma-employer-b@campusjob.local',
      role: UserRole.EMPLOYER,
      status: UserStatus.ACTIVE,
      token: '',
    },
    moderator: {
      id: '',
      email: 'cma-moderator@campusjob.local',
      role: UserRole.MODERATOR,
      status: UserStatus.ACTIVE,
      token: '',
    },
    admin: {
      id: '',
      email: 'cma-admin@campusjob.local',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      token: '',
    },
    suspendedStudent: {
      id: '',
      email: 'cma-suspended-student@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.SUSPENDED,
      token: '',
      profileId: '',
    },
    lockedStudent: {
      id: '',
      email: 'cma-locked-student@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.LOCKED,
      token: '',
      profileId: '',
    },
  };

  // M04 test variables
  const testJobIdA = 'cma-job-a-managed-by-employer-a';
  let createdApplicationIdA = '';

  // Contract Test Adapter for CvSnapshotSource
  const testCvSnapshotSource: CvSnapshotSource = {
    async getOwnedSnapshot(studentId: string, cvId: string): Promise<CvSnapshotDto> {
      if (cvId === accounts.studentA.cvId) {
        return {
          snapshotId: 'cma-snapshot-a',
          originalCvId: accounts.studentA.cvId,
          studentId: accounts.studentA.id,
          fullName: 'Student A',
          email: accounts.studentA.email,
          phone: '0901234567',
          title: 'CV Student A',
          summary: 'Summary A',
          educations: [],
          experiences: [],
          skills: ['TypeScript', 'NestJS'],
          projects: [],
          certifications: [],
          fileUrl: null,
          capturedAt: new Date().toISOString(),
        };
      }
      if (cvId === accounts.studentB.cvId) {
        return {
          snapshotId: 'cma-snapshot-b',
          originalCvId: accounts.studentB.cvId,
          studentId: accounts.studentB.id,
          fullName: 'Student B',
          email: accounts.studentB.email,
          phone: '0909876543',
          title: 'CV Student B',
          summary: 'Summary B',
          educations: [],
          experiences: [],
          skills: ['React', 'Next.js'],
          projects: [],
          certifications: [],
          fileUrl: null,
          capturedAt: new Date().toISOString(),
        };
      }
      throw new M04WorkflowError('NOT_FOUND');
    },
  };

  // Contract Test Adapter for JobAccessSource
  const testJobAccessSource: JobAccessSource = {
    async assertAcceptingApplications(jobId: string): Promise<void> {
      if (jobId === testJobIdA) return;
      throw new M04WorkflowError('NOT_FOUND');
    },
    async assertManagedBy(jobId: string, employerUserId: string): Promise<void> {
      if (jobId === testJobIdA && employerUserId === accounts.employerA.id) {
        return;
      }
      throw new M04WorkflowError('FORBIDDEN');
    },
  };

  async function loginAndGetToken(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: defaultPassword })
      .expect(200);
    return res.body.accessToken || res.body.data?.accessToken;
  }

  async function seedTestUsers() {
    const hash = await PasswordHasher.hash(defaultPassword);

    for (const [key, acc] of Object.entries(accounts)) {
      const user = await prisma.user.upsert({
        where: { email: acc.email },
        create: {
          email: acc.email,
          passwordHash: hash,
          fullName: `User ${key}`,
          role: acc.role,
          status: acc.status,
          emailVerifiedAt: new Date(),
        },
        update: {
          passwordHash: hash,
          status: acc.status,
          emailVerifiedAt: new Date(),
        },
      });
      acc.id = user.id;

      // Seed StudentProfile for students
      if (acc.role === UserRole.STUDENT) {
        const profile = await prisma.studentProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            university: 'Đại học Bách Khoa',
            major: 'Khoa học máy tính',
            graduationYear: 2026,
            skills: ['TypeScript'],
          },
          update: {},
        });
        (acc as any).profileId = profile.id;
      }
    }

    // Seed CV for Student A
    const cvA = await prisma.cv.create({
      data: {
        studentProfileId: accounts.studentA.profileId,
        title: 'CV Backend Node.js - Student A',
        isDefault: true,
        skills: ['TypeScript', 'NestJS'],
      },
    });
    accounts.studentA.cvId = cvA.id;

    // Seed CV for Student B
    const cvB = await prisma.cv.create({
      data: {
        studentProfileId: accounts.studentB.profileId,
        title: 'CV Frontend React - Student B',
        isDefault: true,
        skills: ['React', 'Next.js'],
      },
    });
    accounts.studentB.cvId = cvB.id;

    // Obtain tokens
    accounts.studentA.token = await loginAndGetToken(accounts.studentA.email);
    accounts.studentB.token = await loginAndGetToken(accounts.studentB.email);
    accounts.employerA.token = await loginAndGetToken(accounts.employerA.email);
    accounts.employerB.token = await loginAndGetToken(accounts.employerB.email);
    accounts.moderator.token = await loginAndGetToken(accounts.moderator.email);
    accounts.admin.token = await loginAndGetToken(accounts.admin.email);

    // For suspended & locked users, issue tokens by temporarily setting ACTIVE, logging in, then reverting
    await prisma.user.update({ where: { id: accounts.suspendedStudent.id }, data: { status: UserStatus.ACTIVE } });
    accounts.suspendedStudent.token = await loginAndGetToken(accounts.suspendedStudent.email);
    await prisma.user.update({ where: { id: accounts.suspendedStudent.id }, data: { status: UserStatus.SUSPENDED } });

    await prisma.user.update({ where: { id: accounts.lockedStudent.id }, data: { status: UserStatus.ACTIVE } });
    accounts.lockedStudent.token = await loginAndGetToken(accounts.lockedStudent.email);
    await prisma.user.update({ where: { id: accounts.lockedStudent.id }, data: { status: UserStatus.LOCKED } });
  }

  async function cleanupTestData() {
    try {
      const allEmails = Object.values(accounts).map((a) => a.email);
      const userIds = (await prisma.user.findMany({ where: { email: { in: allEmails } }, select: { id: true } })).map((u) => u.id);

      if (userIds.length > 0) {
        // Delete M04 records
        await prisma.applicationStatusHistory.deleteMany({
          where: { actorId: { in: userIds } },
        });
        await prisma.application.deleteMany({
          where: { studentId: { in: userIds } },
        });

        // Delete CVs
        const profiles = await prisma.studentProfile.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
        const profileIds = profiles.map((p) => p.id);
        if (profileIds.length > 0) {
          await prisma.cv.deleteMany({ where: { studentProfileId: { in: profileIds } } });
          await prisma.studentProfile.deleteMany({ where: { id: { in: profileIds } } });
        }

        // Delete Auth sessions and tokens
        await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: userIds } } });

        // Delete users
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } catch {
      // Ignore cleanup error on teardown
    }
  }

  beforeAll(async () => {
    // 1. Setup AppModule (Production Live E2E)
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    // Initial deterministic cleanup and seeding
    await cleanupTestData();
    await seedTestUsers();

    // 2. Setup M04 Contract Testing Architecture (using real PrismaM04Repository)
    const m04Repo = new PrismaM04Repository(prisma);
    const m04Workflow = new M04Workflow(m04Repo, testCvSnapshotSource, testJobAccessSource);

    const m04ModuleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, AuthModule],
      controllers: [M04Controller],
      providers: [
        { provide: M04Workflow, useValue: m04Workflow },
        RolesGuard,
      ],
    }).compile();

    m04App = m04ModuleRef.createNestApplication();
    m04App.setGlobalPrefix('api/v1');
    m04App.use(cookieParser());
    m04App.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await m04App.init();
  });

  afterAll(async () => {
    await cleanupTestData();
    if (m04App) await m04App.close();
    if (app) await app.close();
  });

  // ==========================================================================
  // Part 1: Real Production Routes Authorization (AppModule Live E2E)
  // Endpoints: /api/v1/students/cvs, /api/v1/students/profile
  // ==========================================================================
  describe('Part 1: Real Production Routes Authorization (AppModule Live E2E)', () => {
    it('T01: should reject unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/cvs')
        .expect(401);

      expect(res.body.code).toBe(AuthErrorCode.UNAUTHORIZED);
    });

    it('T02: should reject EMPLOYER accessing student CVs with 403 FORBIDDEN (Contract C-04)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.employerA.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('T03: should reject MODERATOR accessing student CVs with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.moderator.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('T04: should reject ADMIN accessing student CVs with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.admin.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('T05: should permit valid owner Student A to list own CVs with 200 OK', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/cvs')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      const cvIds = res.body.data.map((c: any) => c.id);
      expect(cvIds).toContain(accounts.studentA.cvId);
      expect(cvIds).not.toContain(accounts.studentB.cvId);
    });

    it('T06: should reject Student B accessing Student A CV detail with 404 CV_NOT_FOUND (Contract C-05 Anti-IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/cvs/${accounts.studentA.cvId}`)
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .expect(404);

      expect(res.body.code).toBe(CvErrorCode.CV_NOT_FOUND);
    });

    it('T07: should reject Student B updating Student A CV with 404 CV_NOT_FOUND (Contract C-05 Anti-IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/students/cvs/${accounts.studentA.cvId}`)
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .send({ title: 'Hacked Title By Student B' })
        .expect(404);

      expect(res.body.code).toBe(CvErrorCode.CV_NOT_FOUND);
    });

    it('T08: should reject Student B setting Student A CV as default with 404 CV_NOT_FOUND (Contract C-05 Anti-IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/students/cvs/${accounts.studentA.cvId}/default`)
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .expect(404);

      expect(res.body.code).toBe(CvErrorCode.CV_NOT_FOUND);
    });

    it('T09: should reject Student B deleting Student A CV with 404 CV_NOT_FOUND (Contract C-05 Anti-IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/students/cvs/${accounts.studentA.cvId}`)
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .expect(404);

      expect(res.body.code).toBe(CvErrorCode.CV_NOT_FOUND);
    });

    it('T10: should reject EMPLOYER accessing student profile with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.employerA.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('T11: should reject SUSPENDED student updating profile with 403 ACCOUNT_SUSPENDED', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.suspendedStudent.token}`)
        .send({ bio: 'Suspended bio update attempt' })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_SUSPENDED);
    });

    it('T12: should reject LOCKED student updating profile with 403 ACCOUNT_LOCKED', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.lockedStudent.token}`)
        .send({ bio: 'Locked bio update attempt' })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
    });
  });

  // ==========================================================================
  // Part 2: Cross-Module Contract Authorization (M04 Dedicated Test Architecture)
  // Endpoints: /api/v1/jobs/:jobId/apply, /api/v1/applications/me/:id,
  //            /api/v1/employer/jobs/:jobId/applications, /api/v1/employer/applications/:id
  // ==========================================================================
  describe('Part 2: Cross-Module Contract Authorization (M04 Dedicated Test Architecture)', () => {
    it('T13: should reject EMPLOYER submitting job application with 403 FORBIDDEN', async () => {
      const res = await request(m04App.getHttpServer())
        .post(`/api/v1/jobs/${testJobIdA}/apply`)
        .set('Authorization', `Bearer ${accounts.employerA.token}`)
        .send({ cvId: accounts.studentA.cvId, coverLetter: 'Employer applying' })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('T14: should reject Student A applying with Student B CV with 403 FORBIDDEN (Contract C-03 Ownership Violation)', async () => {
      const res = await request(m04App.getHttpServer())
        .post(`/api/v1/jobs/${testJobIdA}/apply`)
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .send({ cvId: accounts.studentB.cvId, coverLetter: 'Using foreign CV' })
        .expect(403);

      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('T15: should permit Student A to apply with own CV creating real application in PostgreSQL with 201 CREATED', async () => {
      const res = await request(m04App.getHttpServer())
        .post(`/api/v1/jobs/${testJobIdA}/apply`)
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .send({ cvId: accounts.studentA.cvId, coverLetter: 'Legitimate Application' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.studentId).toBe(accounts.studentA.id);
      expect(res.body.jobId).toBe(testJobIdA);
      expect(res.body.status).toBe('SUBMITTED');

      createdApplicationIdA = res.body.id;

      // Verify persisted record in PostgreSQL
      const persisted = await prisma.application.findUnique({ where: { id: createdApplicationIdA } });
      expect(persisted).not.toBeNull();
      expect(persisted!.studentId).toBe(accounts.studentA.id);
    });

    it('T16: should reject EMPLOYER accessing student applications/me detail with 403 FORBIDDEN', async () => {
      const res = await request(m04App.getHttpServer())
        .get(`/api/v1/applications/me/${createdApplicationIdA}`)
        .set('Authorization', `Bearer ${accounts.employerA.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('T17: should reject Student B viewing Student A application with 404 NOT_FOUND (Anti-IDOR)', async () => {
      const res = await request(m04App.getHttpServer())
        .get(`/api/v1/applications/me/${createdApplicationIdA}`)
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .expect(404);

      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('T18: should reject Student B withdrawing Student A application with 404 NOT_FOUND (Anti-IDOR)', async () => {
      const res = await request(m04App.getHttpServer())
        .patch(`/api/v1/applications/me/${createdApplicationIdA}/withdraw`)
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .expect(404);

      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('T19: should reject STUDENT accessing employer job candidates with 403 FORBIDDEN', async () => {
      const res = await request(m04App.getHttpServer())
        .get(`/api/v1/employer/jobs/${testJobIdA}/applications`)
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('T20: should reject Employer B listing candidates for Employer A job with 403 FORBIDDEN (Job Ownership)', async () => {
      const res = await request(m04App.getHttpServer())
        .get(`/api/v1/employer/jobs/${testJobIdA}/applications`)
        .set('Authorization', `Bearer ${accounts.employerB.token}`)
        .expect(403);

      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('T21: should reject Employer B viewing candidate detail for Employer A job with 403 FORBIDDEN (Job Ownership)', async () => {
      const res = await request(m04App.getHttpServer())
        .get(`/api/v1/employer/applications/${createdApplicationIdA}`)
        .set('Authorization', `Bearer ${accounts.employerB.token}`)
        .expect(403);

      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('T22: should reject Employer B marking application viewed for Employer A job with 403 FORBIDDEN (Job Ownership)', async () => {
      const res = await request(m04App.getHttpServer())
        .patch(`/api/v1/employer/applications/${createdApplicationIdA}/viewed`)
        .set('Authorization', `Bearer ${accounts.employerB.token}`)
        .expect(403);

      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('T23: should reject Employer B rejecting application for Employer A job with 403 FORBIDDEN (Job Ownership)', async () => {
      const res = await request(m04App.getHttpServer())
        .patch(`/api/v1/employer/applications/${createdApplicationIdA}/reject`)
        .set('Authorization', `Bearer ${accounts.employerB.token}`)
        .send({ reason: 'Unauthorized rejection attempt' })
        .expect(403);

      expect(res.body.code).toBe('FORBIDDEN');
    });
  });
});
