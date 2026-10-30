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

const request = supertest;

/**
 * S2-M01-06: Account Integration (E2E & Contract-Boundary Integration Tests)
 *
 * Verifies that the agreed authentication context (AuthContext C-01) is correctly
 * propagated, consumed, and enforced across module boundaries without relying on
 * M01 private services or internal implementations.
 *
 * Architecture Boundaries:
 * - Part 1: Production AppModule E2E Tests (StudentsModule & NotificationsModule)
 * - Part 2: M04 Contract-Boundary Integration Tests (Standalone M04 Test Harness)
 */
describe('S2-M01-06: Account Integration (E2E & Contract-Boundary)', () => {
  let app: INestApplication;
  let m04App: INestApplication;
  let prisma: PrismaService;

  const defaultPassword = 'StrongIntegrationPassword123!@#';

  // Test accounts with deterministic prefix 'ai-'
  const accounts = {
    studentA: {
      id: '',
      email: 'ai-student-a@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      token: '',
      profileId: '',
      cvId: '',
    },
    studentB: {
      id: '',
      email: 'ai-student-b@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      token: '',
      profileId: '',
      cvId: '',
    },
    employerA: {
      id: '',
      email: 'ai-employer-a@campusjob.local',
      role: UserRole.EMPLOYER,
      status: UserStatus.ACTIVE,
      token: '',
    },
    employerB: {
      id: '',
      email: 'ai-employer-b@campusjob.local',
      role: UserRole.EMPLOYER,
      status: UserStatus.ACTIVE,
      token: '',
    },
    moderator: {
      id: '',
      email: 'ai-moderator@campusjob.local',
      role: UserRole.MODERATOR,
      status: UserStatus.ACTIVE,
      token: '',
    },
    admin: {
      id: '',
      email: 'ai-admin@campusjob.local',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      token: '',
    },
    suspendedStudent: {
      id: '',
      email: 'ai-suspended-student@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.SUSPENDED,
      token: '',
      profileId: '',
    },
    lockedStudent: {
      id: '',
      email: 'ai-locked-student@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.LOCKED,
      token: '',
      profileId: '',
    },
    pendingStudent: {
      id: '',
      email: 'ai-pending-student@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.PENDING_VERIFICATION,
      token: '',
      profileId: '',
    },
  };

  // Notification fixtures
  let notifAId = '';
  let notifBId = '';

  // M04 fixtures
  const testJobIdA = 'ai-job-a-managed-by-employer-a';
  let createdApplicationIdA = '';

  // Contract Test Adapter for CvSnapshotSource (M02 boundary isolation)
  const testCvSnapshotSource: CvSnapshotSource = {
    async getOwnedSnapshot(studentId: string, cvId: string): Promise<CvSnapshotDto> {
      if (cvId === accounts.studentA.cvId && studentId === accounts.studentA.id) {
        return {
          snapshotId: 'ai-snapshot-a',
          originalCvId: accounts.studentA.cvId,
          studentId: accounts.studentA.id,
          fullName: 'AI Student A',
          email: accounts.studentA.email,
          phone: '0901234567',
          title: 'CV Student A - Integration',
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
      if (cvId === accounts.studentB.cvId && studentId === accounts.studentB.id) {
        return {
          snapshotId: 'ai-snapshot-b',
          originalCvId: accounts.studentB.cvId,
          studentId: accounts.studentB.id,
          fullName: 'AI Student B',
          email: accounts.studentB.email,
          phone: '0909876543',
          title: 'CV Student B - Integration',
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

  // Contract Test Adapter for JobAccessSource (M03 boundary isolation)
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
    return res.body.accessToken;
  }

  async function seedTestUsers() {
    const hash = await PasswordHasher.hash(defaultPassword);

    for (const [key, acc] of Object.entries(accounts)) {
      const isVerified = acc.status !== UserStatus.PENDING_VERIFICATION;
      const user = await prisma.user.upsert({
        where: { email: acc.email },
        create: {
          email: acc.email,
          passwordHash: hash,
          fullName: `AI User ${key}`,
          role: acc.role,
          status: acc.status,
          emailVerifiedAt: isVerified ? new Date() : null,
        },
        update: {
          passwordHash: hash,
          status: acc.status,
          emailVerifiedAt: isVerified ? new Date() : null,
        },
      });
      acc.id = user.id;

      // Seed StudentProfile for students
      if (acc.role === UserRole.STUDENT) {
        const profile = await prisma.studentProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            university: 'Đại học Quốc gia',
            major: 'Khoa học máy tính',
            graduationYear: 2026,
            bio: `Initial bio for ${key}`,
          },
          update: {
            bio: `Initial bio for ${key}`,
          },
        });
        Object.assign(acc, { profileId: profile.id });
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

    // Seed Notifications
    const notifA = await prisma.notification.create({
      data: {
        recipientId: accounts.studentA.id,
        eventType: 'APPLICATION_STATUS_CHANGED',
        title: 'Thông báo hồ sơ - Sinh viên A',
        body: 'Hồ sơ của bạn đã được tiếp nhận.',
      },
    });
    notifAId = notifA.id;

    const notifB = await prisma.notification.create({
      data: {
        recipientId: accounts.studentB.id,
        eventType: 'APPLICATION_STATUS_CHANGED',
        title: 'Thông báo hồ sơ - Sinh viên B',
        body: 'Nhà tuyển dụng đã xem hồ sơ của bạn.',
      },
    });
    notifBId = notifB.id;

    // Obtain tokens for active accounts
    accounts.studentA.token = await loginAndGetToken(accounts.studentA.email);
    accounts.studentB.token = await loginAndGetToken(accounts.studentB.email);
    accounts.employerA.token = await loginAndGetToken(accounts.employerA.email);
    accounts.employerB.token = await loginAndGetToken(accounts.employerB.email);
    accounts.moderator.token = await loginAndGetToken(accounts.moderator.email);
    accounts.admin.token = await loginAndGetToken(accounts.admin.email);

    // For suspended user: issue token then revert status to SUSPENDED
    await prisma.user.update({ where: { id: accounts.suspendedStudent.id }, data: { status: UserStatus.ACTIVE } });
    accounts.suspendedStudent.token = await loginAndGetToken(accounts.suspendedStudent.email);
    await prisma.user.update({ where: { id: accounts.suspendedStudent.id }, data: { status: UserStatus.SUSPENDED } });

    // For locked user: issue token then revert status to LOCKED
    await prisma.user.update({ where: { id: accounts.lockedStudent.id }, data: { status: UserStatus.ACTIVE } });
    accounts.lockedStudent.token = await loginAndGetToken(accounts.lockedStudent.email);
    await prisma.user.update({ where: { id: accounts.lockedStudent.id }, data: { status: UserStatus.LOCKED } });

    // For pending user: issue token then revert status to PENDING_VERIFICATION
    await prisma.user.update({
      where: { id: accounts.pendingStudent.id },
      data: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
    });
    accounts.pendingStudent.token = await loginAndGetToken(accounts.pendingStudent.email);
    await prisma.user.update({
      where: { id: accounts.pendingStudent.id },
      data: { status: UserStatus.PENDING_VERIFICATION, emailVerifiedAt: null },
    });
  }

  async function cleanupTestData() {
    try {
      const allEmails = Object.values(accounts).map((a) => a.email);
      const userIds = (await prisma.user.findMany({ where: { email: { in: allEmails } }, select: { id: true } })).map((u) => u.id);

      if (userIds.length > 0) {
        // Delete Notifications
        await prisma.notification.deleteMany({
          where: { recipientId: { in: userIds } },
        });

        // Delete M04 records
        await prisma.applicationStatusHistory.deleteMany({
          where: { actorId: { in: userIds } },
        });
        await prisma.application.deleteMany({
          where: { studentId: { in: userIds } },
        });

        // Delete CVs and Profiles
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

    // 2. Setup M04 Dedicated Contract-Boundary Testing Architecture
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
  // Part 1: Production AppModule E2E Tests (StudentsModule & NotificationsModule)
  // Endpoints: /api/v1/students/profile, /api/v1/notifications
  // ==========================================================================
  describe('Part 1: Production AppModule E2E Tests (Students & Notifications)', () => {
    it('TC-01: authenticated student receives data strictly belonging to own identity', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .expect(200);

      expect(res.body.profile).toBeDefined();
      expect(res.body.profile.userId).toBe(accounts.studentA.id);
      expect(res.body.profile.email).toBe(accounts.studentA.email);
      expect(res.body.profile.id).toBe(accounts.studentA.profileId);
    });

    it('TC-02 & TC-03: caller cannot spoof identity by passing forged userId in request body, and other user profile is not modified', async () => {
      // Student A tries to update Student B's profile by injecting studentB.id in request body
      const spoofedBody = {
        userId: accounts.studentB.id,
        bio: 'Malicious Bio Injected by Student A',
        skills: ['TypeScript', 'SecurityAuditing'],
      };

      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .send(spoofedBody)
        .expect(200);

      // Verify that the response reflects Student A's profile updated, NOT Student B's
      expect(res.body.profile.userId).toBe(accounts.studentA.id);
      expect(res.body.profile.bio).toBe('Malicious Bio Injected by Student A');

      // Verify in database: Student A's profile was updated
      const studentAInDb = await prisma.studentProfile.findUnique({
        where: { userId: accounts.studentA.id },
      });
      expect(studentAInDb?.bio).toBe('Malicious Bio Injected by Student A');

      // Crucial assertion: Student B's profile in database remains completely UNTOUCHED
      const studentBInDb = await prisma.studentProfile.findUnique({
        where: { userId: accounts.studentB.id },
      });
      expect(studentBInDb?.bio).toBe('Initial bio for studentB');
      expect(studentBInDb?.userId).toBe(accounts.studentB.id);
    });

    it('TC-04: cross-role access is rejected per RBAC rules (EMPLOYER and MODERATOR rejected with 403 FORBIDDEN)', async () => {
      // Employer attempting to access student-only profile
      const employerRes = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.employerA.token}`)
        .expect(403);

      expect(employerRes.body.code).toBe(AuthErrorCode.FORBIDDEN);

      // Moderator attempting to access student-only profile
      const moderatorRes = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.moderator.token}`)
        .expect(403);

      expect(moderatorRes.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('TC-05: unauthenticated request is rejected with 401 UNAUTHORIZED on consuming endpoints', async () => {
      const studentProfileRes = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .expect(401);

      expect(studentProfileRes.body.code).toBe(AuthErrorCode.UNAUTHORIZED);

      const notifRes = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .expect(401);

      expect(notifRes.body.code).toBe(AuthErrorCode.UNAUTHORIZED);
    });

    it('TC-06: suspended account is blocked from consuming modules with 403 ACCOUNT_SUSPENDED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.suspendedStudent.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_SUSPENDED);

      const notifRes = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${accounts.suspendedStudent.token}`)
        .expect(403);

      expect(notifRes.body.code).toBe(AuthErrorCode.ACCOUNT_SUSPENDED);
    });

    it('TC-07: locked account is blocked from consuming modules with 403 ACCOUNT_LOCKED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.lockedStudent.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);

      const notifRes = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${accounts.lockedStudent.token}`)
        .expect(403);

      expect(notifRes.body.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
    });

    it('TC-08: pending verification account is blocked from consuming modules with 403 ACCOUNT_PENDING_VERIFICATION', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.pendingStudent.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_PENDING_VERIFICATION);

      const notifRes = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${accounts.pendingStudent.token}`)
        .expect(403);

      expect(notifRes.body.code).toBe(AuthErrorCode.ACCOUNT_PENDING_VERIFICATION);
    });

    it('TC-09 & TC-10: notification listing is strictly scoped to authenticated recipient and isolated across users', async () => {
      // Student A views notifications
      const resA = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .expect(200);

      expect(Array.isArray(resA.body.data)).toBe(true);
      const idsA = resA.body.data.map((n: { id: string }) => n.id);
      expect(idsA).toContain(notifAId);
      expect(idsA).not.toContain(notifBId); // Student A CANNOT see Student B's notification

      // Student B views notifications
      const resB = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .expect(200);

      expect(Array.isArray(resB.body.data)).toBe(true);
      const idsB = resB.body.data.map((n: { id: string }) => n.id);
      expect(idsB).toContain(notifBId);
      expect(idsB).not.toContain(notifAId); // Student B CANNOT see Student A's notification
    });
  });

  // ==========================================================================
  // Part 2: M04 Contract-Boundary Integration Tests (Standalone M04 Harness)
  // Endpoints: /api/v1/jobs/:jobId/apply, /api/v1/employer/jobs/:jobId/applications
  // ==========================================================================
  describe('Part 2: M04 Contract-Boundary Integration Tests (Applications & Interviews)', () => {
    it('TC-11: M04 receives and uses correct authenticated student identity from principal', async () => {
      const res = await request(m04App.getHttpServer())
        .post(`/api/v1/jobs/${testJobIdA}/apply`)
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .send({ cvId: accounts.studentA.cvId, coverLetter: 'Account Integration Cover Letter' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.studentId).toBe(accounts.studentA.id);
      expect(res.body.jobId).toBe(testJobIdA);
      expect(res.body.status).toBe('SUBMITTED');

      createdApplicationIdA = res.body.id;

      // Verify persistent record in PostgreSQL
      const persisted = await prisma.application.findUnique({ where: { id: createdApplicationIdA } });
      expect(persisted).not.toBeNull();
      expect(persisted!.studentId).toBe(accounts.studentA.id);
      expect(persisted!.jobId).toBe(testJobIdA);
    });

    it('TC-12: M04 enforces RBAC restrictions (EMPLOYER rejected from applying with 403 FORBIDDEN)', async () => {
      const res = await request(m04App.getHttpServer())
        .post(`/api/v1/jobs/${testJobIdA}/apply`)
        .set('Authorization', `Bearer ${accounts.employerA.token}`)
        .send({ cvId: accounts.studentA.cvId, coverLetter: 'Employer applying' })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('TC-13: M04 enforces resource ownership (Employer B rejected from viewing Employer A job candidates with 403 FORBIDDEN)', async () => {
      const res = await request(m04App.getHttpServer())
        .get(`/api/v1/employer/jobs/${testJobIdA}/applications`)
        .set('Authorization', `Bearer ${accounts.employerB.token}`)
        .expect(403);

      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('TC-14: M04 permits legitimate job owner Employer A to view candidates with 200 OK', async () => {
      const res = await request(m04App.getHttpServer())
        .get(`/api/v1/employer/jobs/${testJobIdA}/applications`)
        .set('Authorization', `Bearer ${accounts.employerA.token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const appIds = res.body.map((a: { id: string }) => a.id);
      expect(appIds).toContain(createdApplicationIdA);
    });
  });
});
