import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Controller, Get, UseGuards } from '@nestjs/common';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { GlobalExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { UserRole, UserStatus, AuthErrorCode } from '@campusjob/contracts';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';
import { RolesGuard } from '../src/shared/guards/roles.guard';
import { Roles } from '../src/shared/decorators/roles.decorator';
import { Public } from '../src/shared/decorators/public.decorator';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';

const request = supertest;

// Test controllers to verify route-level and controller-level RBAC enforcement
@Controller('test-rbac')
@UseGuards(JwtAuthGuard, RolesGuard)
class RbacTestController {
  @Get('admin-only')
  @Roles(UserRole.ADMIN)
  adminOnly() {
    return { ok: true, access: 'ADMIN_GRANTED' };
  }

  @Get('moderator-only')
  @Roles(UserRole.MODERATOR)
  moderatorOnly() {
    return { ok: true, access: 'MODERATOR_GRANTED' };
  }

  @Get('student-or-employer')
  @Roles(UserRole.STUDENT, UserRole.EMPLOYER)
  studentOrEmployer() {
    return { ok: true, access: 'STUDENT_OR_EMPLOYER_GRANTED' };
  }

  @Get('any-authenticated')
  anyAuthenticated() {
    return { ok: true, access: 'ANY_AUTHENTICATED_GRANTED' };
  }
}

// Controller-level @Roles decorator to test inheritance and method-level override
@Controller('test-rbac-precedence')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
class RbacPrecedenceTestController {
  @Get('inherited-admin')
  inheritedAdmin() {
    return { ok: true, access: 'INHERITED_ADMIN_GRANTED' };
  }

  @Get('overridden-to-student')
  @Roles(UserRole.STUDENT)
  overriddenToStudent() {
    return { ok: true, access: 'OVERRIDDEN_STUDENT_GRANTED' };
  }

  @Get('public-endpoint')
  @Public()
  publicEndpoint() {
    return { ok: true, access: 'PUBLIC_GRANTED' };
  }
}

describe('RBAC Authorization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testPassword = 'Password123!@#$';

  const users = {
    student: {
      email: 'rbac-student@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      token: '',
    },
    employer: {
      email: 'rbac-employer@campusjob.local',
      role: UserRole.EMPLOYER,
      status: UserStatus.ACTIVE,
      token: '',
    },
    moderator: {
      email: 'rbac-moderator@campusjob.local',
      role: UserRole.MODERATOR,
      status: UserStatus.ACTIVE,
      token: '',
    },
    admin: {
      email: 'rbac-admin@campusjob.local',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      token: '',
    },
    suspended: {
      email: 'rbac-suspended@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.SUSPENDED,
      token: '',
    },
    locked: {
      email: 'rbac-locked@campusjob.local',
      role: UserRole.STUDENT,
      status: UserStatus.LOCKED,
      token: '',
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RbacTestController, RbacPrecedenceTestController],
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

    // Clean up any stale test users
    await cleanupDatabase();

    // Create test accounts with hashed passwords
    const passwordHash = await PasswordHasher.hash(testPassword);
    for (const key of Object.keys(users) as (keyof typeof users)[]) {
      const u = users[key];
      await prisma.user.create({
        data: {
          email: u.email,
          fullName: `RBAC ${key.toUpperCase()}`,
          passwordHash,
          role: u.role,
          status: u.status,
          emailVerifiedAt: new Date(),
        },
      });
    }

    // Login ACTIVE users to acquire real JWT access tokens
    for (const key of ['student', 'employer', 'moderator', 'admin'] as const) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: users[key].email,
          password: testPassword,
        })
        .expect(200);

      users[key].token = res.body.accessToken;
    }
  });

  afterAll(async () => {
    await cleanupDatabase();
    if (app) {
      await app.close();
    }
  });

  async function cleanupDatabase() {
    const allEmails = Object.values(users).map((u) => u.email);
    await prisma.authSession.deleteMany({
      where: { user: { email: { in: allEmails } } },
    });
    await prisma.auditLog.deleteMany({
      where: { actor: { email: { in: allEmails } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: allEmails } },
    });
  }

  describe('Unauthenticated requests to RBAC-protected routes', () => {
    it('should reject request without token with 401 UNAUTHORIZED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/admin-only')
        .expect(401);

      expect(res.body.statusCode).toBe(401);
      expect(res.body.code).toBe(AuthErrorCode.UNAUTHORIZED);
    });

    it('should reject request with malformed Bearer token with 401 UNAUTHORIZED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/admin-only')
        .set('Authorization', 'Bearer completely-invalid-jwt-token')
        .expect(401);

      expect(res.body.statusCode).toBe(401);
      expect(res.body.code).toBe(AuthErrorCode.UNAUTHORIZED);
    });
  });

  describe('Single-role restriction: @Roles(UserRole.ADMIN)', () => {
    it('should allow ADMIN user to access admin-only endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/admin-only')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(res.body.access).toBe('ADMIN_GRANTED');
    });

    it('should forbid STUDENT user with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/admin-only')
        .set('Authorization', `Bearer ${users.student.token}`)
        .expect(403);

      expect(res.body.statusCode).toBe(403);
      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
      expect(res.body.message).toBe('Bạn không có quyền truy cập tài nguyên này.');
    });

    it('should forbid EMPLOYER user with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/admin-only')
        .set('Authorization', `Bearer ${users.employer.token}`)
        .expect(403);

      expect(res.body.statusCode).toBe(403);
      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('should forbid MODERATOR user with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/admin-only')
        .set('Authorization', `Bearer ${users.moderator.token}`)
        .expect(403);

      expect(res.body.statusCode).toBe(403);
      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });
  });

  describe('Single-role restriction: @Roles(UserRole.MODERATOR)', () => {
    it('should allow MODERATOR user to access moderator-only endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/moderator-only')
        .set('Authorization', `Bearer ${users.moderator.token}`)
        .expect(200);

      expect(res.body.access).toBe('MODERATOR_GRANTED');
    });

    it('should forbid STUDENT user with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/moderator-only')
        .set('Authorization', `Bearer ${users.student.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('should forbid EMPLOYER user with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/moderator-only')
        .set('Authorization', `Bearer ${users.employer.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('should forbid ADMIN user from moderator-only when ADMIN is not explicitly in allowed list', async () => {
      // Respect strict RBAC: no assumed admin override without explicit permission in decorator
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/moderator-only')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });
  });

  describe('Multiple-roles restriction: @Roles(UserRole.STUDENT, UserRole.EMPLOYER)', () => {
    it('should allow STUDENT user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/student-or-employer')
        .set('Authorization', `Bearer ${users.student.token}`)
        .expect(200);

      expect(res.body.access).toBe('STUDENT_OR_EMPLOYER_GRANTED');
    });

    it('should allow EMPLOYER user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/student-or-employer')
        .set('Authorization', `Bearer ${users.employer.token}`)
        .expect(200);

      expect(res.body.access).toBe('STUDENT_OR_EMPLOYER_GRANTED');
    });

    it('should forbid MODERATOR user with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/student-or-employer')
        .set('Authorization', `Bearer ${users.moderator.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('should forbid ADMIN user with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/student-or-employer')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });
  });

  describe('Absence of role restrictions: Authenticated route without @Roles', () => {
    it('should allow any authenticated role (STUDENT, EMPLOYER, MODERATOR, ADMIN)', async () => {
      for (const key of ['student', 'employer', 'moderator', 'admin'] as const) {
        const res = await request(app.getHttpServer())
          .get('/api/v1/test-rbac/any-authenticated')
          .set('Authorization', `Bearer ${users[key].token}`)
          .expect(200);

        expect(res.body.access).toBe('ANY_AUTHENTICATED_GRANTED');
      }
    });

    it('should still reject unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/any-authenticated')
        .expect(401);

      expect(res.body.code).toBe(AuthErrorCode.UNAUTHORIZED);
    });
  });

  describe('Precedence: Controller-level vs Method-level @Roles', () => {
    it('should inherit Controller-level @Roles(ADMIN) when method has no @Roles', async () => {
      // ADMIN user can access
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac-precedence/inherited-admin')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      // STUDENT user is forbidden
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac-precedence/inherited-admin')
        .set('Authorization', `Bearer ${users.student.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('should override Controller-level @Roles(ADMIN) when method specifies @Roles(STUDENT)', async () => {
      // STUDENT user can access overridden endpoint
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac-precedence/overridden-to-student')
        .set('Authorization', `Bearer ${users.student.token}`)
        .expect(200);

      // ADMIN user is now forbidden because handler overridden to STUDENT only
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac-precedence/overridden-to-student')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });

    it('should allow unauthenticated access to @Public() method on protected controller', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac-precedence/public-endpoint')
        .expect(200);

      expect(res.body.access).toBe('PUBLIC_GRANTED');
    });
  });

  describe('Security: Untrusted client-side fields cannot forge role', () => {
    it('should prevent STUDENT from gaining ADMIN access via request headers or body', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/admin-only')
        .set('Authorization', `Bearer ${users.student.token}`)
        .set('x-role', 'ADMIN')
        .set('x-user-role', 'ADMIN')
        .query({ role: 'ADMIN' })
        .send({ role: 'ADMIN' })
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.FORBIDDEN);
    });
  });

  describe('Production user lookup authorization', () => {
    async function userId(key: keyof typeof users): Promise<string> {
      const user = await prisma.user.findUnique({ where: { email: users[key].email }, select: { id: true } });
      if (!user) throw new Error(`Missing seeded user ${key}`);
      return user.id;
    }

    it('rejects anonymous and invalid JWT requests', async () => {
      const id = await userId('student');
      await request(app.getHttpServer()).get(`/api/v1/users/${id}`).expect(401);
      const invalid = await request(app.getHttpServer())
        .get(`/api/v1/users/${id}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      expect(invalid.body.code).toBe(AuthErrorCode.UNAUTHORIZED);
    });

    it('allows a user to view their own public profile', async () => {
      const id = await userId('student');
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${id}`)
        .set('Authorization', `Bearer ${users.student.token}`)
        .expect(200);
      expect(response.body).toEqual({
        id,
        email: users.student.email,
        fullName: 'RBAC STUDENT',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      });
    });

    it.each(['student', 'employer', 'moderator'] as const)(
      'denies %s from viewing another account without trusting client role fields',
      async (key) => {
        const targetId = await userId('employer');
        const response = await request(app.getHttpServer())
          .get(`/api/v1/users/${targetId}`)
          .set('Authorization', `Bearer ${users[key].token}`)
          .set('x-role', 'ADMIN')
          .set('x-user-role', 'ADMIN')
          .query({ role: 'ADMIN' })
          .expect(403);
        expect(response.body.code).toBe(AuthErrorCode.FORBIDDEN);
      },
    );

    it('allows ADMIN to view another account and returns only the public DTO', async () => {
      const targetId = await userId('student');
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${targetId}`)
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);
      expect(Object.keys(response.body).sort()).toEqual(
        ['email', 'emailVerified', 'fullName', 'id', 'role', 'status'].sort(),
      );
    });

    it('returns 404 for an authorized request to a missing account', async () => {
      const missingId = '00000000-0000-4000-8000-000000000001';
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${missingId}`)
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(404);
      expect(response.body.statusCode).toBe(404);
    });
  });

  describe('Account status checks precedence before role authorization', () => {
    it('should reject suspended user with 403 ACCOUNT_SUSPENDED even on valid token', async () => {
      // Manually issue a token for the suspended user by temporarily activating, logging in, then suspending
      const suspendedUser = await prisma.user.findUnique({
        where: { email: users.suspended.email },
      });
      await prisma.user.update({
        where: { id: suspendedUser!.id },
        data: { status: UserStatus.ACTIVE },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: users.suspended.email, password: testPassword })
        .expect(200);

      const suspendedToken = loginRes.body.accessToken;

      // Re-suspend
      await prisma.user.update({
        where: { id: suspendedUser!.id },
        data: { status: UserStatus.SUSPENDED },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/test-rbac/any-authenticated')
        .set('Authorization', `Bearer ${suspendedToken}`)
        .expect(403);

      expect(res.body.code).toBe(AuthErrorCode.ACCOUNT_SUSPENDED);
    });
  });
});
