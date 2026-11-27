import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import supertest from 'supertest';
import * as argon2 from 'argon2';
import { configureApplication } from '../src/configure-app';
import { DatabaseModule } from '../src/shared/database/database.module';
import { StorageModule } from '../src/shared/storage/storage.module';
import { UsersModule } from '../src/modules/users/users.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { MailModule } from '../src/shared/mail/mail.module';
import { StudentsModule } from '../src/modules/students/students.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import {
  CAMPUS_VERIFICATION_MAILER_TOKEN,
  ICampusVerificationMailer,
} from '../src/shared/mail/mail.service.interface';
import {
  AuthErrorCode,
  StudentProfileErrorCode,
  UserRole,
  UserStatus,
} from '@campusjob/contracts';

const request = supertest;

describe('COND-M02-01: Student Campus Email & OTP Verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const dispatchedOtps: Array<{ to: string; otpCode: string; ttlMinutes: number }> = [];
  const fakeMailer: ICampusVerificationMailer = {
    async sendCampusVerificationOtpEmail(to, otpCode, ttlMinutes) {
      dispatchedOtps.push({ to, otpCode, ttlMinutes });
    },
  };

  const defaultPassword = 'TestPassword123!@#';
  const PREFIX = 'cond-m02-01-';

  const accounts = {
    studentA: {
      id: '',
      profileId: '',
      email: `${PREFIX}student-a@campusjob.local`,
      fullName: 'Sinh Viên A - COND-M02-01',
      role: UserRole.STUDENT,
      token: '',
    },
    studentB: {
      id: '',
      profileId: '',
      email: `${PREFIX}student-b@campusjob.local`,
      fullName: 'Sinh Viên B - COND-M02-01',
      role: UserRole.STUDENT,
      token: '',
    },
    employer: {
      id: '',
      email: `${PREFIX}employer@campusjob.local`,
      fullName: 'Employer - COND-M02-01',
      role: UserRole.EMPLOYER,
      token: '',
    },
  };

  async function loginUser(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: defaultPassword })
      .expect(200);
    return res.body.accessToken as string;
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

      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      if (profileIds.length > 0) {
        await prisma.campusEmailVerificationToken.deleteMany({
          where: { studentProfileId: { in: profileIds } },
        });
        await prisma.studentProfile.deleteMany({
          where: { id: { in: profileIds } },
        });
      }
      await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [
            path.resolve(process.cwd(), '.env'),
            path.resolve(__dirname, '../../../.env'),
          ],
        }),
        DatabaseModule,
        StorageModule,
        UsersModule,
        AuthModule,
        MailModule,
        StudentsModule,
      ],
    })
      .overrideProvider(CAMPUS_VERIFICATION_MAILER_TOKEN)
      .useValue(fakeMailer)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

    prisma = app.get(PrismaService);
    await cleanupDatabase();

    const passwordHash = await argon2.hash(defaultPassword, {
      type: argon2.argon2id,
    });

    for (const acc of Object.values(accounts)) {
      const user = await prisma.user.create({
        data: {
          email: acc.email,
          fullName: acc.fullName,
          passwordHash,
          role: acc.role,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });
      acc.id = user.id;

      if (acc.role === UserRole.STUDENT) {
        const profile = await prisma.studentProfile.create({
          data: { userId: user.id },
        });
        (acc as { profileId: string }).profileId = profile.id;
      }

      acc.token = await loginUser(acc.email);
    }
  });

  afterAll(async () => {
    if (prisma) {
      await cleanupDatabase();
    }
    if (app) {
      await app.close();
    }
  });

  it('rejects unauthenticated (401) and non-STUDENT roles (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/request')
      .send({ campusEmail: '21520001@gm.uit.edu.vn' })
      .expect(401);

    const empRes = await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/request')
      .set('Authorization', `Bearer ${accounts.employer.token}`)
      .send({ campusEmail: '21520001@gm.uit.edu.vn' })
      .expect(403);

    expect(empRes.body.code).toBe(AuthErrorCode.FORBIDDEN);
  });

  it('prevents self-verification by string injection on PATCH /students/profile', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/students/profile')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .send({
        isCampusVerified: true,
        campusEmail: '21520001@gm.uit.edu.vn',
      })
      .expect(400);

    const profileRes = await request(app.getHttpServer())
      .get('/api/v1/students/profile')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .expect(200);

    expect(profileRes.body.profile.isCampusVerified).toBe(false);
    expect(profileRes.body.profile.campusEmail).toBeNull();
  });

  it('rejects disallowed domains (.com / spoofing)', async () => {
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/request')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .send({ campusEmail: 'student@gmail.com' })
      .expect(400);
    expect(res1.body.code).toBe(
      StudentProfileErrorCode.CAMPUS_EMAIL_DOMAIN_NOT_ALLOWED,
    );

    const res2 = await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/request')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .send({ campusEmail: 'student@uit.edu.vn.fake.com' })
      .expect(400);
    expect(res2.body.code).toBe(
      StudentProfileErrorCode.CAMPUS_EMAIL_DOMAIN_NOT_ALLOWED,
    );
  });

  it('enforces OTP lifecycle: request does not auto-verify, rate-limits resend, rejects expired/wrong/reused OTP, and verifies on valid OTP', async () => {
    const campusEmail = `${PREFIX}sv@gm.uit.edu.vn`;

    // 1. Request OTP
    const reqRes = await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/request')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .send({ campusEmail })
      .expect(200);

    expect(reqRes.body.campusEmail).toBe(campusEmail);
    expect(reqRes.body.resendCooldownSeconds).toBe(60);
    expect(dispatchedOtps).toHaveLength(1);
    const firstOtp = dispatchedOtps[0].otpCode;

    // Profile must NOT be verified yet just from requesting
    const beforeConfirm = await request(app.getHttpServer())
      .get('/api/v1/students/profile')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .expect(200);
    expect(beforeConfirm.body.profile.isCampusVerified).toBe(false);
    expect(beforeConfirm.body.profile.campusEmail).toBeNull();

    // 2. Immediate resend hits 60s cooldown -> 429
    const cooldownRes = await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/request')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .send({ campusEmail })
      .expect(429);
    expect(cooldownRes.body.code).toBe(
      StudentProfileErrorCode.CAMPUS_OTP_RATE_LIMITED,
    );

    // 3. Wrong OTP -> 400
    const wrongOtp = firstOtp === '000000' ? '000001' : '000000';
    const wrongRes = await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/confirm')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .send({ campusEmail, otp: wrongOtp })
      .expect(400);
    expect(wrongRes.body.code).toBe(StudentProfileErrorCode.CAMPUS_OTP_INVALID);

    // 4. Simulate expiration in DB -> 400 CAMPUS_OTP_EXPIRED
    await prisma.campusEmailVerificationToken.updateMany({
      where: { studentProfileId: accounts.studentA.profileId, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expiredRes = await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/confirm')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .send({ campusEmail, otp: firstOtp })
      .expect(400);
    expect(expiredRes.body.code).toBe(StudentProfileErrorCode.CAMPUS_OTP_EXPIRED);

    // 5. Backdate createdAt to bypass cooldown for new OTP request
    await prisma.campusEmailVerificationToken.updateMany({
      where: { studentProfileId: accounts.studentA.profileId },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });

    await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/request')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .send({ campusEmail })
      .expect(200);
    expect(dispatchedOtps).toHaveLength(2);
    const secondOtp = dispatchedOtps[1].otpCode;

    // 6. Confirm valid second OTP -> 200 OK
    const confirmRes = await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/confirm')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .send({ campusEmail, otp: secondOtp })
      .expect(200);

    expect(confirmRes.body.profile.isCampusVerified).toBe(true);
    expect(confirmRes.body.profile.campusEmail).toBe(campusEmail);
    expect(confirmRes.body.campusVerifiedAt).toBeDefined();

    // 7. Reusing the same OTP must fail -> 400 CAMPUS_OTP_INVALID
    const reuseRes = await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/confirm')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .send({ campusEmail, otp: secondOtp })
      .expect(400);
    expect(reuseRes.body.code).toBe(StudentProfileErrorCode.CAMPUS_OTP_INVALID);

    // 8. Student A requesting OTP again for same verified email -> 400 CAMPUS_EMAIL_ALREADY_VERIFIED
    const alreadyVerifiedRes = await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/request')
      .set('Authorization', `Bearer ${accounts.studentA.token}`)
      .send({ campusEmail })
      .expect(400);
    expect(alreadyVerifiedRes.body.code).toBe(
      StudentProfileErrorCode.CAMPUS_EMAIL_ALREADY_VERIFIED,
    );

    // 9. Student B attempting to claim Student A's verified campusEmail -> 409 CAMPUS_EMAIL_ALREADY_IN_USE
    const conflictRes = await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/request')
      .set('Authorization', `Bearer ${accounts.studentB.token}`)
      .send({ campusEmail })
      .expect(409);
    expect(conflictRes.body.code).toBe(
      StudentProfileErrorCode.CAMPUS_EMAIL_ALREADY_IN_USE,
    );

    // 10. AuditLog recorded
    const audit = await prisma.auditLog.findFirst({
      where: {
        actorId: accounts.studentA.id,
        action: 'CAMPUS_EMAIL_VERIFIED',
        entityType: 'StudentProfile',
        entityId: accounts.studentA.profileId,
      },
    });
    expect(audit).not.toBeNull();
  });

  it('locks OTP after 5 failed attempts with 429 CAMPUS_OTP_MAX_ATTEMPTS', async () => {
    const campusEmail = `${PREFIX}lock@gm.uit.edu.vn`;

    await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/request')
      .set('Authorization', `Bearer ${accounts.studentB.token}`)
      .send({ campusEmail })
      .expect(200);

    const latest = dispatchedOtps[dispatchedOtps.length - 1];
    const wrongOtp = latest.otpCode === '999999' ? '999998' : '999999';

    for (let i = 0; i < 4; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/students/campus-verification/confirm')
        .set('Authorization', `Bearer ${accounts.studentB.token}`)
        .send({ campusEmail, otp: wrongOtp })
        .expect(400);
    }

    const fifthRes = await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/confirm')
      .set('Authorization', `Bearer ${accounts.studentB.token}`)
      .send({ campusEmail, otp: wrongOtp })
      .expect(429);
    expect(fifthRes.body.code).toBe(
      StudentProfileErrorCode.CAMPUS_OTP_MAX_ATTEMPTS,
    );

    // Even the right OTP cannot be used once locked/consumed
    await request(app.getHttpServer())
      .post('/api/v1/students/campus-verification/confirm')
      .set('Authorization', `Bearer ${accounts.studentB.token}`)
      .send({ campusEmail, otp: latest.otpCode })
      .expect(400);
  });
});

