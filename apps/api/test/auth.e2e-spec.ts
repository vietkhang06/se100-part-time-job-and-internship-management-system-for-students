import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { GlobalExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { UserRole, UserStatus, AuthErrorCode } from '@campusjob/contracts';
import { TokenUtils } from '../src/modules/auth/infrastructure/security/token.utils';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';
import { MAIL_SERVICE_TOKEN } from '../src/shared/mail/mail.service.interface';

const request = supertest;

describe('AuthModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testStudentEmail = 'e2e-student@campusjob.local';
  const testEmployerEmail = 'e2e-employer@campusjob.local';
  const testStrongPassword = 'SuperSecret123!@#';

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

    // Không gửi mail qua SMTP thật
    const mailService = app.get(MAIL_SERVICE_TOKEN, { strict: false }) as object;
    Object.assign(mailService, { transporter: { sendMail: async () => ({ messageId: 'e2e' }) } });

    // Clean up test records
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    if (app) {
      await app.close();
    }
  });

  async function cleanupDatabase() {
    const testEmails = [
      testStudentEmail,
      testEmployerEmail,
      'concurrent@campusjob.local',
      'concurrent-reset@campusjob.local',
    ];
    await prisma.authSession.deleteMany({
      where: { user: { email: { in: testEmails } } },
    });
    await prisma.emailVerificationToken.deleteMany({
      where: { user: { email: { in: testEmails } } },
    });
    await prisma.passwordResetToken.deleteMany({
      where: { user: { email: { in: testEmails } } },
    });
    await prisma.auditLog.deleteMany({
      where: { actor: { email: { in: testEmails } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: testEmails } },
    });
  }

  async function ensureActiveStudent(password = 'BrandNewPassword999!@#') {
    const hash = await PasswordHasher.hash(password);
    return prisma.user.upsert({
      where: { email: testStudentEmail },
      create: {
        email: testStudentEmail,
        passwordHash: hash,
        fullName: 'Sinh Vien E2E',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
      update: {
        passwordHash: hash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
  }

  async function ensureActiveEmployer(password = testStrongPassword) {
    const hash = await PasswordHasher.hash(password);
    return prisma.user.upsert({
      where: { email: testEmployerEmail },
      create: {
        email: testEmployerEmail,
        passwordHash: hash,
        fullName: 'Doanh Nghiep E2E',
        role: UserRole.EMPLOYER,
        status: UserStatus.PENDING_VERIFICATION,
      },
      update: {},
    });
  }

  describe('POST /api/v1/auth/register', () => {
    it('should register a Student successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `  ${testStudentEmail}  `,
          password: testStrongPassword,
          fullName: 'Sinh Vien E2E',
          role: UserRole.STUDENT,
          phone: '0912345678',
        })
        .expect(201);

      expect(res.body).toHaveProperty('message');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.email).toBe(testStudentEmail);
      expect(res.body.user.role).toBe(UserRole.STUDENT);
      expect(res.body.user.status).toBe(UserStatus.PENDING_VERIFICATION);
      expect(res.body.user.emailVerified).toBe(false);

      // Verify no sensitive fields in response
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.token).toBeUndefined();

      // Verify DB record
      const dbUser = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      expect(dbUser).toBeDefined();
      expect(dbUser!.passwordHash).not.toBe(testStrongPassword);
      const isMatch = await PasswordHasher.verify(dbUser!.passwordHash, testStrongPassword);
      expect(isMatch).toBe(true);

      // Verify token in DB
      const dbToken = await prisma.emailVerificationToken.findFirst({
        where: { userId: dbUser!.id },
      });
      expect(dbToken).toBeDefined();
      expect(dbToken!.usedAt).toBeNull();
    });

    it('should register an Employer successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: testEmployerEmail,
          password: testStrongPassword,
          fullName: 'Doanh Nghiep E2E',
          role: UserRole.EMPLOYER,
        })
        .expect(201);

      expect(res.body.user.role).toBe(UserRole.EMPLOYER);
    });

    it('should reject registration with ADMIN or MODERATOR role', async () => {
      const resAdmin = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'fakeadmin@campusjob.local',
          password: testStrongPassword,
          fullName: 'Fake Admin',
          role: UserRole.ADMIN,
        })
        .expect(400);

      expect(resAdmin.body.code).toBe(AuthErrorCode.ROLE_DISALLOWED);
      expect(resAdmin.body.statusCode).toBe(400);

      const resMod = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'fakemod@campusjob.local',
          password: testStrongPassword,
          fullName: 'Fake Mod',
          role: UserRole.MODERATOR,
        })
        .expect(400);

      expect(resMod.body.code).toBe(AuthErrorCode.ROLE_DISALLOWED);
    });

    it('should reject registration with invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: testStrongPassword,
          fullName: 'Invalid Email',
          role: UserRole.STUDENT,
        })
        .expect(400);

      expect(res.body.code).toBe(AuthErrorCode.VALIDATION_ERROR);
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('should reject registration with duplicate email regardless of casing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: testStudentEmail.toUpperCase(),
          password: testStrongPassword,
          fullName: 'Duplicate Student',
          role: UserRole.STUDENT,
        })
        .expect(409);

      expect(res.body.code).toBe(AuthErrorCode.EMAIL_ALREADY_EXISTS);
      expect(res.body.statusCode).toBe(409);
    });

    it('should reject registration with weak password not meeting policy', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'weakpass@campusjob.local',
          password: 'weakpassword',
          fullName: 'Weak Password',
          role: UserRole.STUDENT,
        })
        .expect(400);

      expect(res.body.code).toBe(AuthErrorCode.WEAK_PASSWORD);
      expect(res.body.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('should verify email successfully with valid token', async () => {
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      const rawToken = 'my-e2e-raw-verification-token';
      const tokenHash = TokenUtils.hashToken(rawToken);

      await prisma.emailVerificationToken.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: rawToken })
        .expect(200);

      expect(res.body.email).toBe(testStudentEmail);

      // Verify DB state
      const updatedUser = await prisma.user.findUnique({ where: { id: user!.id } });
      expect(updatedUser!.status).toBe(UserStatus.ACTIVE);
      expect(updatedUser!.emailVerifiedAt).not.toBeNull();

      const updatedToken = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
      expect(updatedToken!.usedAt).not.toBeNull();
    });

    it('should reject already used token (cannot use second time)', async () => {
      const rawToken = 'used-token-e2e';
      const tokenHash = TokenUtils.hashToken(rawToken);
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });

      await prisma.emailVerificationToken.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 3600000),
          usedAt: new Date(),
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: rawToken })
        .expect(400);
    });

    it('should reject expired token', async () => {
      const rawToken = 'expired-token-e2e';
      const tokenHash = TokenUtils.hashToken(rawToken);
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });

      await prisma.emailVerificationToken.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt: new Date(Date.now() - 3600000), // Expired 1h ago
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: rawToken })
        .expect(400);
    });

    it('should reject invalid / non-existing token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: 'completely-non-existent-token' })
        .expect(400);
    });

    it('should handle concurrent verification requests gracefully (only 1 succeeds)', async () => {
      const rawToken = 'concurrent-verify-token-123';
      const tokenHash = TokenUtils.hashToken(rawToken);

      const user = await prisma.user.create({
        data: {
          email: 'concurrent@campusjob.local',
          fullName: 'Concurrent User',
          passwordHash: 'hash',
          role: UserRole.STUDENT,
          status: UserStatus.PENDING_VERIFICATION,
        },
      });

      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      // Fire 2 simultaneous requests
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token: rawToken }),
        request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token: rawToken }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 400]);
    });
  });

  describe('POST /api/v1/auth/resend-verification', () => {
    it('should reject resend for an already verified account', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ email: testStudentEmail })
        .expect(400);
    });

    it('should reject resend when requested within cooldown (< 60s)', async () => {
      // testEmployerEmail is still PENDING_VERIFICATION
      const employer = await prisma.user.findUnique({ where: { email: testEmployerEmail } });

      // Create a token 10s ago
      await prisma.emailVerificationToken.create({
        data: {
          userId: employer!.id,
          tokenHash: 'recent-resend-hash',
          expiresAt: new Date(Date.now() + 3600000),
          createdAt: new Date(Date.now() - 10000),
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ email: testEmployerEmail })
        .expect(429);
    });

    it('should successfully resend and invalidate old token when cooldown has passed', async () => {
      const employer = await prisma.user.findUnique({ where: { email: testEmployerEmail } });

      // Update existing tokens to have createdAt 70 seconds ago
      await prisma.emailVerificationToken.updateMany({
        where: { userId: employer!.id },
        data: { createdAt: new Date(Date.now() - 70000), usedAt: null },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ email: testEmployerEmail })
        .expect(200);

      expect(res.body.message).toContain('verification email has been sent');

      // Verify older tokens were invalidated
      const oldTokens = await prisma.emailVerificationToken.findMany({
        where: {
          userId: employer!.id,
          createdAt: { lt: new Date(Date.now() - 60000) },
        },
      });
      for (const tok of oldTokens) {
        expect(tok.usedAt).not.toBeNull();
      }
    });
  });

  describe('POST /api/v1/auth/forgot-password & /api/v1/auth/reset-password', () => {
    beforeAll(async () => {
      await ensureActiveStudent(testStrongPassword);
    });

    it('should return neutral response when email exists without leaking', async () => {
      // Ensure cooldown does not block by clearing recent tokens
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: user!.id } });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: testStudentEmail })
        .expect(200);

      expect(res.body.message).toContain('If this email address is registered');

      // Verify token created in DB
      const resetToken = await prisma.passwordResetToken.findFirst({
        where: { userId: user!.id },
      });
      expect(resetToken).toBeDefined();
      expect(resetToken!.usedAt).toBeNull();
    });

    it('should return identical neutral response when email does NOT exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@campusjob.local' })
        .expect(200);

      expect(res.body.message).toContain('If this email address is registered');
    });

    it('should enforce cooldown on forgot password (< 60s)', async () => {
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: user!.id } });
      await prisma.passwordResetToken.create({
        data: {
          userId: user!.id,
          tokenHash: 'cooldown-token-hash-e2e',
          expiresAt: new Date(Date.now() + 3600000),
          createdAt: new Date(),
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: testStudentEmail })
        .expect(429);
    });

    it('should reset password successfully with valid token and revoke active sessions', async () => {
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      const rawResetToken = 'valid-e2e-reset-token-789';
      const tokenHash = TokenUtils.hashToken(rawResetToken);

      // Create reset token
      await prisma.passwordResetToken.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      // Create an active session to test session revocation
      const session = await prisma.authSession.create({
        data: {
          userId: user!.id,
          tokenHash: 'session-token-hash-1',
          tokenFamily: 'family-1',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const newPassword = 'BrandNewPassword999!@#';

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawResetToken,
          newPassword,
        })
        .expect(200);

      expect(res.body.message).toContain('Password has been reset successfully');

      // Verify user's new password in DB
      const updatedUser = await prisma.user.findUnique({ where: { id: user!.id } });
      const oldMatch = await PasswordHasher.verify(updatedUser!.passwordHash, testStrongPassword);
      const newMatch = await PasswordHasher.verify(updatedUser!.passwordHash, newPassword);
      expect(oldMatch).toBe(false);
      expect(newMatch).toBe(true);

      // Verify reset token used
      const dbResetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
      expect(dbResetToken!.usedAt).not.toBeNull();

      // Verify active session was REVOKED
      const dbSession = await prisma.authSession.findUnique({ where: { id: session.id } });
      expect(dbSession!.revokedAt).not.toBeNull();
    });

    it('should reject reset with weak password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'any-token',
          newPassword: 'weak',
        })
        .expect(400);
    });

    it('should reject reset with expired or used token', async () => {
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      const rawToken = 'expired-reset-token';
      const tokenHash = TokenUtils.hashToken(rawToken);

      await prisma.passwordResetToken.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt: new Date(Date.now() - 3600000), // Expired
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'BrandNewPassword999!@#',
        })
        .expect(400);
    });

    it('should handle concurrent reset requests gracefully (only 1 succeeds)', async () => {
      // Use dedicated user to avoid mutating testStudentEmail fixture
      const concurrentUser = await prisma.user.create({
        data: {
          email: 'concurrent-reset@campusjob.local',
          passwordHash: await PasswordHasher.hash(testStrongPassword),
          fullName: 'Concurrent Reset User',
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
        },
      });
      const rawToken = 'concurrent-reset-token-999';
      const tokenHash = TokenUtils.hashToken(rawToken);

      await prisma.passwordResetToken.create({
        data: {
          userId: concurrentUser.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      // Fire 2 simultaneous requests
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/auth/reset-password')
          .send({ token: rawToken, newPassword: 'ConcurPass1!@#' }),
        request(app.getHttpServer())
          .post('/api/v1/auth/reset-password')
          .send({ token: rawToken, newPassword: 'ConcurPass2!@#' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 400]);
    });

    it('should reject login with old password and allow login with new password after reset', async () => {
      // Old password must fail
      const oldLoginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: testStrongPassword,
        })
        .expect(401);

      expect(oldLoginRes.body.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);

      // New password must succeed
      const newLoginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      expect(newLoginRes.body.accessToken).toBeDefined();
    });

    it('should not revoke unrelated user sessions during password reset', async () => {
      const employer = await prisma.user.findUnique({ where: { email: testEmployerEmail } });
      const student = await prisma.user.findUnique({ where: { email: testStudentEmail } });

      // Create an active session for employer
      const employerSession = await prisma.authSession.create({
        data: {
          userId: employer!.id,
          tokenHash: 'unrelated-employer-token-hash',
          tokenFamily: 'family-employer-keep',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      // Create a reset token for student and reset password
      const rawToken = 'student-reset-isolate-token';
      const tokenHash = TokenUtils.hashToken(rawToken);

      await prisma.passwordResetToken.create({
        data: {
          userId: student!.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'BrandNewStudentPassword777!@#',
        })
        .expect(200);

      // Verify employer session is still ACTIVE (revokedAt is null)
      const freshEmployerSession = await prisma.authSession.findUnique({
        where: { id: employerSession.id },
      });
      expect(freshEmployerSession!.revokedAt).toBeNull();

      // Restore student password back to BrandNewPassword999!@# for subsequent login tests
      const restoredHash = await PasswordHasher.hash('BrandNewPassword999!@#');
      await prisma.user.update({
        where: { id: student!.id },
        data: { passwordHash: restoredHash },
      });
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeAll(async () => {
      await ensureActiveStudent('BrandNewPassword999!@#');
      await ensureActiveEmployer();
    });

    afterEach(async () => {
      await ensureActiveStudent('BrandNewPassword999!@#');
    });

    it('should login successfully with valid credentials and return access token + refresh cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testStudentEmail);
      expect(res.body.user.role).toBe(UserRole.STUDENT);

      // Verify HttpOnly cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies]).find(
        (c: string) => c.includes('campusjob_refresh_token') || c.includes('refreshToken'),
      );
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('should reject login with incorrect password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(res.body.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    });

    it('should reject login for non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'unknown-user@campusjob.local',
          password: 'Password123!',
        })
        .expect(401);

      expect(res.body.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    });

    it('should reject login when account is pending verification', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmployerEmail,
          password: testStrongPassword,
        })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_PENDING_VERIFICATION);
    });

    it('should reject login when account is suspended', async () => {
      // Temporarily mark student as SUSPENDED
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.SUSPENDED },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_SUSPENDED);

      // Restore status to ACTIVE
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.ACTIVE },
      });
    });

    it('should reject login when account is locked', async () => {
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.LOCKED },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
      expect(res.body.statusCode).toBe(403);

      // Restore status to ACTIVE
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.ACTIVE },
      });
    });
  });

  describe('GET /api/v1/auth/me', () => {
    beforeAll(async () => {
      await ensureActiveStudent('BrandNewPassword999!@#');
    });

    it('should return current user when valid Bearer access token is provided', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      const accessToken = loginRes.body.accessToken;

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testStudentEmail);
      expect(res.body.user.id).toBe(loginRes.body.user.id);
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);

      expect(res.body.code).toBe(AuthErrorCode.UNAUTHORIZED);
    });

    it('should return 401 when invalid token is provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-malformed-access-token')
        .expect(401);

      expect(res.body.code).toBe(AuthErrorCode.UNAUTHORIZED);
      expect(res.body.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    beforeAll(async () => {
      await ensureActiveStudent('BrandNewPassword999!@#');
      await ensureActiveEmployer();
    });

    afterEach(async () => {
      await ensureActiveStudent('BrandNewPassword999!@#');
    });

    it('should rotate refresh token and issue new access token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      const loginCookies = loginRes.headers['set-cookie'];

      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', loginCookies)
        .expect(200);

      expect(refreshRes.body).toHaveProperty('accessToken');
      expect(refreshRes.body.accessToken).not.toBe(loginRes.body.accessToken);
      expect(refreshRes.body).toHaveProperty('user');
      expect(refreshRes.body.user.email).toBe(testStudentEmail);

      const rotatedCookies = refreshRes.headers['set-cookie'];
      expect(rotatedCookies).toBeDefined();
    });

    it('should detect token reuse and revoke the entire token family', async () => {
      // Clear old sessions so only this token family exists
      const userBefore = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      await prisma.authSession.deleteMany({ where: { userId: userBefore!.id } });

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      const initialCookie = loginRes.headers['set-cookie'];

      // First refresh: consumes initialCookie, rotates to new cookie
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', initialCookie)
        .expect(200);

      // Second refresh using STOLEN / ALREADY CONSUMED initialCookie: REUSE ATTACK!
      const reuseRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', initialCookie)
        .expect(401);

      expect(reuseRes.body.message).toContain('thu hồi');
      expect(reuseRes.body.code).toBe(AuthErrorCode.REFRESH_TOKEN_REUSED);

      // Verify in DB that all sessions for this user have been revoked
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      const activeSessions = await prisma.authSession.findMany({
        where: { userId: user!.id, revokedAt: null },
      });
      expect(activeSessions.length).toBe(0);
    });

    it('should reject refresh when refresh token is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .expect(401);

      expect(res.body.code).toBe(AuthErrorCode.REFRESH_TOKEN_MISSING);
    });

    it('should reject refresh when refresh token is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', ['campusjob_refresh_token=invalid_non_existent_token_hex_12345678'])
        .expect(401);

      expect(res.body.code).toBe(AuthErrorCode.REFRESH_TOKEN_INVALID);
      expect(res.body.statusCode).toBe(401);
    });

    it('should reject refresh when refresh token is expired', async () => {
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      const expiredRawToken = 'expired_raw_token_' + Date.now();
      const expiredTokenHash = TokenUtils.hashToken(expiredRawToken);
      await prisma.authSession.create({
        data: {
          userId: user!.id,
          tokenHash: expiredTokenHash,
          tokenFamily: 'expired-family-' + Date.now(),
          expiresAt: new Date(Date.now() - 60000), // 1 minute in the past
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`campusjob_refresh_token=${expiredRawToken}`])
        .expect(401);

      expect(res.body.code).toBe(AuthErrorCode.REFRESH_TOKEN_EXPIRED);
      expect(res.body.statusCode).toBe(401);
    });

    it('should reject refresh when account is suspended', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      const cookies = loginRes.headers['set-cookie'];
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.SUSPENDED },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_SUSPENDED);
      expect(res.body.statusCode).toBe(403);

      // Restore status to ACTIVE
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.ACTIVE },
      });
    });

    it('should reject refresh when account is locked', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      const cookies = loginRes.headers['set-cookie'];
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.LOCKED },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
      expect(res.body.statusCode).toBe(403);

      // Restore status to ACTIVE
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.ACTIVE },
      });
    });

    it('should reject refresh when account is pending verification', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      const cookies = loginRes.headers['set-cookie'];
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.PENDING_VERIFICATION },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_PENDING_VERIFICATION);
      expect(res.body.statusCode).toBe(403);

      // Restore status to ACTIVE
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.ACTIVE },
      });
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    beforeAll(async () => {
      await ensureActiveStudent('BrandNewPassword999!@#');
    });

    it('should logout current session and clear refresh cookie', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      const cookie = loginRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.ok).toBe(true);

      // Verify cookie cleared
      const setCookies = res.headers['set-cookie'];
      expect(setCookies).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    beforeAll(async () => {
      await ensureActiveStudent('BrandNewPassword999!@#');
    });

    it('should revoke all active sessions for current user', async () => {
      // Create session 1
      const loginRes1 = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      // Create session 2
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      const accessToken = loginRes1.body.accessToken;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.message).toContain('tất cả phiên');

      // Verify no active sessions remain in DB
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      const remainingActiveSessions = await prisma.authSession.findMany({
        where: { userId: user!.id, revokedAt: null },
      });
      expect(remainingActiveSessions.length).toBe(0);
    });

    it('should reject logout-all when unauthenticated', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout-all')
        .expect(401);

      expect(res.body.code).toBe(AuthErrorCode.UNAUTHORIZED);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    beforeAll(async () => {
      await ensureActiveStudent('BrandNewPassword999!@#');
    });

    beforeEach(async () => {
      await ensureActiveStudent('BrandNewPassword999!@#');
    });

    it('should reject change-password when unauthenticated', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: 'AnyPassword123!',
          newPassword: 'BrandNewPassword123!',
        })
        .expect(401);

      expect(res.body.code).toBe(AuthErrorCode.UNAUTHORIZED);
    });

    it('should reject change-password when current password is incorrect', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      const token = loginRes.body.accessToken;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongCurrentPassword123!',
          newPassword: 'BrandNewChangedPass456!@#',
        })
        .expect(400);

      expect(res.body.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      expect(res.body.message).toContain('Current password is incorrect');
    });

    it('should reject change-password when new password is identical to current password', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      const token = loginRes.body.accessToken;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'BrandNewPassword999!@#',
          newPassword: 'BrandNewPassword999!@#',
        })
        .expect(400);

      expect(res.body.code).toBe(AuthErrorCode.VALIDATION_ERROR);
      expect(res.body.message).toContain('must be different');
    });

    it('should reject change-password when new password violates complexity policy', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      const token = loginRes.body.accessToken;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'BrandNewPassword999!@#',
          newPassword: 'weak',
        })
        .expect(400);

      expect(res.body.code).toBe(AuthErrorCode.WEAK_PASSWORD);
    });

    it('should successfully change password, revoke all refresh sessions, authenticate with new password, and reject old password', async () => {
      // 1. Login to get token and create refresh session
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(200);

      const token = loginRes.body.accessToken;
      const oldCookies = loginRes.headers['set-cookie'];

      // 2. Change password
      const newPassword = 'FullyChangedPassword789!@#';
      const changeRes = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'BrandNewPassword999!@#',
          newPassword,
        })
        .expect(200);

      expect(changeRes.body.message).toContain('Password has been changed successfully');

      // 3. Verify in DB that refresh sessions were revoked
      const user = await prisma.user.findUnique({ where: { email: testStudentEmail } });
      const activeSessions = await prisma.authSession.findMany({
        where: { userId: user!.id, revokedAt: null },
      });
      expect(activeSessions.length).toBe(0);

      // 4. Old refresh token should be rejected
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', oldCookies)
        .expect(401);

      // 5. Old password should fail login
      const oldLoginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: 'BrandNewPassword999!@#',
        })
        .expect(401);
      expect(oldLoginRes.body.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);

      // 6. New password should succeed login
      const newLoginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testStudentEmail,
          password: newPassword,
        })
        .expect(200);
      expect(newLoginRes.body.accessToken).toBeDefined();

      // Restore password back to testStrongPassword for test idempotence
      const newHashed = await PasswordHasher.hash(testStrongPassword);
      await prisma.user.update({
        where: { id: user!.id },
        data: { passwordHash: newHashed },
      });
    });
  });
});

