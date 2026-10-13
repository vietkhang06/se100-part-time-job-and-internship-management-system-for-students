import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { GlobalExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { UserRole, UserStatus, AuthErrorCode } from '@campusjob/contracts';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';
import { TokenUtils } from '../src/modules/auth/infrastructure/security/token.utils';

const request = (typeof supertest === 'function' ? supertest : (supertest as any).default) as typeof supertest;

describe('Account State Enforcement (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testPassword = 'StatePassword123!@#';
  const pendingEmail = 'state-pending@campusjob.local';
  const activeEmail = 'state-active@campusjob.local';
  const suspendedEmail = 'state-suspended@campusjob.local';
  const lockedEmail = 'state-locked@campusjob.local';

  const allTestEmails = [pendingEmail, activeEmail, suspendedEmail, lockedEmail];

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
    await seedTestUsers();
  });

  afterAll(async () => {
    await cleanupDatabase();
    if (app) {
      await app.close();
    }
  });

  async function cleanupDatabase() {
    await prisma.authSession.deleteMany({
      where: { user: { email: { in: allTestEmails } } },
    });
    await prisma.emailVerificationToken.deleteMany({
      where: { user: { email: { in: allTestEmails } } },
    });
    await prisma.passwordResetToken.deleteMany({
      where: { user: { email: { in: allTestEmails } } },
    });
    await prisma.auditLog.deleteMany({
      where: { actor: { email: { in: allTestEmails } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: allTestEmails } },
    });
  }

  async function seedTestUsers() {
    const passwordHash = await PasswordHasher.hash(testPassword);

    await prisma.user.create({
      data: {
        email: pendingEmail,
        passwordHash,
        fullName: 'Pending Student',
        role: UserRole.STUDENT,
        status: UserStatus.PENDING_VERIFICATION,
        emailVerifiedAt: null,
      },
    });

    await prisma.user.create({
      data: {
        email: activeEmail,
        passwordHash,
        fullName: 'Active Student',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.user.create({
      data: {
        email: suspendedEmail,
        passwordHash,
        fullName: 'Suspended Student',
        role: UserRole.STUDENT,
        status: UserStatus.SUSPENDED,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.user.create({
      data: {
        email: lockedEmail,
        passwordHash,
        fullName: 'Locked Student',
        role: UserRole.STUDENT,
        status: UserStatus.LOCKED,
        emailVerifiedAt: new Date(),
      },
    });
  }

  describe('1. Login Matrix Enforcement', () => {
    it('should reject login for PENDING_VERIFICATION with 403 ACCOUNT_PENDING_VERIFICATION', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: pendingEmail,
          password: testPassword,
        })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_PENDING_VERIFICATION);
      expect(res.body.message).toContain('chưa được xác minh');
    });

    it('should allow login for ACTIVE account with 200 OK', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: activeEmail,
          password: testPassword,
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.status).toBe(UserStatus.ACTIVE);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject login for SUSPENDED with 403 ACCOUNT_SUSPENDED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: suspendedEmail,
          password: testPassword,
        })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_SUSPENDED);
      expect(res.body.message).toContain('đình chỉ');
    });

    it('should reject login for LOCKED with 403 ACCOUNT_LOCKED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: lockedEmail,
          password: testPassword,
        })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
      expect(res.body.message).toContain('khóa tạm thời');
    });
  });

  describe('2. Refresh Token Matrix Enforcement', () => {
    it('should rotate token successfully when user is ACTIVE', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: activeEmail,
          password: testPassword,
        })
        .expect(200);

      const cookie = loginRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject refresh and not mutate session when user is changed to SUSPENDED', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: activeEmail,
          password: testPassword,
        })
        .expect(200);

      const cookie = loginRes.headers['set-cookie'];
      const user = await prisma.user.findUnique({ where: { email: activeEmail } });

      // Change user status to SUSPENDED
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.SUSPENDED },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_SUSPENDED);

      // Restore active status
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.ACTIVE },
      });
    });

    it('should reject refresh and not mutate session when user is changed to LOCKED', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: activeEmail,
          password: testPassword,
        })
        .expect(200);

      const cookie = loginRes.headers['set-cookie'];
      const user = await prisma.user.findUnique({ where: { email: activeEmail } });

      // Change user status to LOCKED
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.LOCKED },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);

      // Restore active status
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.ACTIVE },
      });
    });

    it('should reject refresh when user is changed to PENDING_VERIFICATION', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: activeEmail,
          password: testPassword,
        })
        .expect(200);

      const cookie = loginRes.headers['set-cookie'];
      const user = await prisma.user.findUnique({ where: { email: activeEmail } });

      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.PENDING_VERIFICATION },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_PENDING_VERIFICATION);

      // Restore active status
      await prisma.user.update({
        where: { id: user!.id },
        data: { status: UserStatus.ACTIVE },
      });
    });
  });

  describe('3. JWT Protected Route Access Matrix (/api/v1/auth/me)', () => {
    let validAccessToken: string;
    let userId: string;

    beforeEach(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: activeEmail,
          password: testPassword,
        })
        .expect(200);

      validAccessToken = loginRes.body.accessToken;
      userId = loginRes.body.user.id;
    });

    afterEach(async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.ACTIVE },
      });
    });

    it('should allow access when account is ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(res.body.user.email).toBe(activeEmail);
      expect(res.body.user.status).toBe(UserStatus.ACTIVE);
    });

    it('should reject access with 403 ACCOUNT_SUSPENDED when account becomes SUSPENDED', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.SUSPENDED },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_SUSPENDED);
    });

    it('should reject access with 403 ACCOUNT_LOCKED when account becomes LOCKED', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.LOCKED },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
    });

    it('should reject access with 403 ACCOUNT_PENDING_VERIFICATION when account becomes PENDING_VERIFICATION', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.PENDING_VERIFICATION },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_PENDING_VERIFICATION);
    });
  });

  describe('4. Resend Verification Matrix', () => {
    it('should allow resend verification for PENDING_VERIFICATION account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ email: pendingEmail })
        .expect(200);

      expect(res.body).toHaveProperty('message');
    });

    it('should reject resend verification for ACTIVE account with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ email: activeEmail })
        .expect(400);

      expect(res.body.message).toContain('already been verified');
    });

    it('should reject resend verification for SUSPENDED account with 403 ACCOUNT_SUSPENDED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ email: suspendedEmail })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_SUSPENDED);
    });

    it('should reject resend verification for LOCKED account with 403 ACCOUNT_LOCKED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ email: lockedEmail })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_LOCKED);
    });
  });

  describe('5. Email Verification Transition (PENDING_VERIFICATION -> ACTIVE)', () => {
    it('should activate user and transition status from PENDING_VERIFICATION to ACTIVE', async () => {
      const user = await prisma.user.findUnique({ where: { email: pendingEmail } });
      expect(user!.status).toBe(UserStatus.PENDING_VERIFICATION);

      const rawToken = TokenUtils.generateRandomToken(32);
      const tokenHash = TokenUtils.hashToken(rawToken);

      await prisma.emailVerificationToken.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: rawToken })
        .expect(200);

      expect(res.body.message).toContain('now active');

      // Verify DB state transition
      const updatedUser = await prisma.user.findUnique({ where: { id: user!.id } });
      expect(updatedUser!.status).toBe(UserStatus.ACTIVE);
      expect(updatedUser!.emailVerifiedAt).not.toBeNull();

      // Now the user can log in!
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: pendingEmail,
          password: testPassword,
        })
        .expect(200);
    });
  });
});
