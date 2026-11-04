import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { GlobalExceptionFilter } from '../src/shared/filters/http-exception.filter';
import {
  UserRole,
  UserStatus,
  AuthErrorCode,
  JobSeekingStatus,
  StudentProfileDto,
} from '@campusjob/contracts';

const request = supertest;

describe('S4-M02-01: StudentProfile DTO Mapping & Normalized Skills (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const defaultPassword = 'TestPassword123!@#';
  const PREFIX = 's4-m02-01-';

  const accounts = {
    studentA: {
      id: '',
      email: `${PREFIX}student-a@campusjob.local`,
      fullName: 'Sinh Viên A - S4-M02-01',
      phone: '0901112233',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      token: '',
      profileId: '',
    },
    studentB: {
      id: '',
      email: `${PREFIX}student-b@campusjob.local`,
      fullName: 'Sinh Viên B - S4-M02-01',
      phone: '0904445566',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      token: '',
      profileId: '',
    },
    employer: {
      id: '',
      email: `${PREFIX}employer@campusjob.local`,
      fullName: 'Nhà Tuyển Dụng - S4-M02-01',
      phone: '0907778899',
      role: UserRole.EMPLOYER,
      status: UserStatus.ACTIVE,
      token: '',
    },
  };

  async function loginUser(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: defaultPassword })
      .expect(200);
    return res.body.accessToken;
  }

  async function cleanupDatabase() {
    const emails = Object.values(accounts).map((a) => a.email);
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);

    if (userIds.length > 0) {
      const profiles = await prisma.studentProfile.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      const profileIds = profiles.map((p) => p.id);

      if (profileIds.length > 0) {
        await prisma.cv.deleteMany({ where: { studentProfileId: { in: profileIds } } });
        await prisma.studentSkill.deleteMany({ where: { studentProfileId: { in: profileIds } } });
        await prisma.studentProfile.deleteMany({ where: { id: { in: profileIds } } });
      }

      await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  }

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

    await cleanupDatabase();

    const passwordHash = await argon2.hash(defaultPassword, { type: argon2.argon2id });

    // Seed test users
    for (const [key, acc] of Object.entries(accounts)) {
      const user = await prisma.user.create({
        data: {
          email: acc.email,
          fullName: acc.fullName,
          phone: acc.phone,
          passwordHash,
          role: acc.role,
          status: acc.status,
          emailVerifiedAt: new Date(),
        },
      });
      acc.id = user.id;

      if (acc.role === UserRole.STUDENT) {
        const profile = await prisma.studentProfile.create({
          data: {
            userId: user.id,
            university: key === 'studentA' ? 'Đại học Bách Khoa TP.HCM' : 'Đại học KHTN',
            major: key === 'studentA' ? 'Khoa học Máy tính' : 'Hệ thống Thông tin',
            graduationYear: 2026,
            jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
            bio: `Tiểu sử mẫu của ${acc.fullName}`,
          },
        });
        (acc as { profileId: string }).profileId = profile.id;

        // Seed normalized skills via StudentSkill relation for studentA
        if (key === 'studentA') {
          const skillNames = ['TypeScript', 'NestJS', 'PostgreSQL'];
          for (const sName of skillNames) {
            const skill = await prisma.skill.upsert({
              where: { normalizedName: sName.toLowerCase() },
              update: {},
              create: { name: sName, normalizedName: sName.toLowerCase() },
            });
            await prisma.studentSkill.create({
              data: {
                studentProfileId: profile.id,
                skillId: skill.id,
              },
            });
          }
        }
      }

      acc.token = await loginUser(acc.email);
    }
  });

  afterAll(async () => {
    await cleanupDatabase();
    if (app) {
      await app.close();
    }
  });

  // ============================================================================
  // 1. GET PROFILE & CONTRACT DTO ALIGNMENT
  // ============================================================================
  describe('1. GET /api/v1/students/profile (DTO Contract & Normalized Skills)', () => {
    it('S4-M02-01-E2E-01: should return full StudentProfileDto matching all 16 contract fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .expect(200);

      expect(res.body).toHaveProperty('profile');
      const profile: StudentProfileDto = res.body.profile;

      // Identity & Contact
      expect(profile.id).toBe(accounts.studentA.profileId);
      expect(profile.userId).toBe(accounts.studentA.id);
      expect(profile.fullName).toBe(accounts.studentA.fullName);
      expect(profile.email).toBe(accounts.studentA.email);
      expect(profile.phone).toBe(accounts.studentA.phone);

      // Academic & Career
      expect(profile.university).toBe('Đại học Bách Khoa TP.HCM');
      expect(profile.major).toBe('Khoa học Máy tính');
      expect(profile.graduationYear).toBe(2026);
      expect(profile.jobSeekingStatus).toBe(JobSeekingStatus.ACTIVELY_LOOKING);
      expect(profile.bio).toContain('Sinh Viên A');

      // Normalized Skills mapped from StudentSkill relation
      expect(Array.isArray(profile.skills)).toBe(true);
      expect(profile.skills.sort()).toEqual(['NestJS', 'PostgreSQL', 'TypeScript'].sort());

      // Safe defaults for non-persisted fields (ADR-015: no fake data)
      expect(profile.avatarUrl).toBeNull();
      expect(profile.isCampusVerified).toBe(false);
      expect(profile.campusEmail).toBeNull();

      // Timestamps
      expect(profile.createdAt).toBeDefined();
      expect(profile.updatedAt).toBeDefined();
    });

    it('S4-M02-01-E2E-02: should return empty skills array when student has no skills linked', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .expect(200);

      expect(res.body.profile).toBeDefined();
      expect(Array.isArray(res.body.profile.skills)).toBe(true);
      expect(res.body.profile.skills).toHaveLength(0);
    });

    it('S4-M02-01-E2E-03: should reject unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .expect(401);

      expect(res.body.code).toBe(AuthErrorCode.UNAUTHORIZED);
    });

    it('S4-M02-01-E2E-04: should reject non-STUDENT role (EMPLOYER) with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.employer.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });
  });

  // ============================================================================
  // 2. PATCH PROFILE & SAFE PERSISTENCE
  // ============================================================================
  describe('2. PATCH /api/v1/students/profile (Safe Update & Relation Protection)', () => {
    it('S4-M02-01-E2E-05: should update profile and reconcile StudentSkill associations correctly', async () => {
      const updatePayload = {
        university: 'Đại học Quốc gia TP.HCM',
        bio: 'Đã cập nhật tiểu sử cho Sprint 4',
        jobSeekingStatus: JobSeekingStatus.OPEN_FOR_OPPORTUNITIES,
        skills: ['React', 'NextJS', 'TypeScript'],
      };

      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .send(updatePayload)
        .expect(200);

      const profile: StudentProfileDto = res.body.profile;
      expect(profile.university).toBe('Đại học Quốc gia TP.HCM');
      expect(profile.bio).toBe('Đã cập nhật tiểu sử cho Sprint 4');
      expect(profile.jobSeekingStatus).toBe(JobSeekingStatus.OPEN_FOR_OPPORTUNITIES);
      expect(profile.skills.sort()).toEqual(['NextJS', 'React', 'TypeScript'].sort());

      // Direct Database Assertion: verify StudentSkill table contains exactly 3 skills
      const dbStudentSkills = await prisma.studentSkill.findMany({
        where: { studentProfileId: accounts.studentA.profileId },
        include: { skill: true },
      });
      const skillNamesInDb = dbStudentSkills.map((ss) => ss.skill.name);
      expect(skillNamesInDb.sort()).toEqual(['NextJS', 'React', 'TypeScript'].sort());
    });

    it('S4-M02-01-E2E-06: should reject payload with forbidden or relation fields (anti-tampering)', async () => {
      const maliciousPayload = {
        userId: accounts.studentB.id, // Attempt to hijack identity
        studentSkills: [{ id: 'fake-id' }], // Attempt to inject relation
        avatarUrl: 'https://malicious.example.com/avatar.png', // Field outside scope
      };

      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .send(maliciousPayload)
        .expect(400);

      expect(res.body.error).toBe('Bad Request');
    });

    it('S4-M02-01-E2E-07: Resource Ownership is preserved - caller cannot update another student profile', async () => {
      // Student B calls PATCH /profile -> should only update Student B's profile
      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .send({ bio: 'Bio của Student B riêng biệt' })
        .expect(200);

      expect(res.body.profile.userId).toBe(accounts.studentB.id);
      expect(res.body.profile.bio).toBe('Bio của Student B riêng biệt');

      // Verify Student A's profile is intact
      const checkA = await request(app.getHttpServer())
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${accounts.studentA.token}`)
        .expect(200);

      expect(checkA.body.profile.userId).toBe(accounts.studentA.id);
      expect(checkA.body.profile.bio).not.toBe('Bio của Student B riêng biệt');
    });
  });
});
