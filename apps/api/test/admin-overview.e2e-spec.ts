import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';
import {
  OverviewGroupKey,
  OverviewGroupStatus,
  AdminOverviewDto,
  UserRole,
  UserStatus,
  ViolationReportStatus,
} from '@campusjob/contracts';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { GlobalExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';
import { OverviewSourceRegistry } from '../src/modules/admin-overview/application/ports/overview-source.port';

const request = supertest;

/**
 * S3-M05-02 — Tổng quan hệ thống (UC54): kiểm thử đối soát dữ liệu.
 * Số liệu API phải khớp với truy vấn trực tiếp vào bảng nguồn, thay đổi theo dữ liệu thật (không hardcode),
 * và chỉ Quản trị viên được truy cập.
 */
describe('S3-M05-02: Admin Overview (UC54) — đối soát với dữ liệu nguồn', () => {
  const PREFIX = 'ovw-';
  const PASSWORD = 'Password123!@#$';
  const RUN_ID = Date.now().toString(36);
  let seq = 0;

  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let moderatorToken: string;
  let studentToken: string;

  const api = () => request(app.getHttpServer());
  const overview = (token?: string) => {
    const call = api().get('/api/v1/admin/overview');
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };
  const group = (body: AdminOverviewDto, key: OverviewGroupKey) => body.groups.find((g) => g.key === key);

  async function createUser(label: string, role: UserRole, login: boolean): Promise<{ id: string; token: string }> {
    const email = `${PREFIX}${label}-${RUN_ID}-${++seq}@campusjob.local`;
    const user = await prisma.user.create({
      data: {
        email,
        fullName: `Overview ${label}`,
        passwordHash: await PasswordHasher.hash(PASSWORD),
        role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    let token = '';
    if (login) {
      const res = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
      token = res.body.accessToken;
    }
    return { id: user.id, token };
  }

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.violationReport.deleteMany({ where: { reporterId: { in: ids } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    await cleanup();
    adminToken = (await createUser('admin', UserRole.ADMIN, true)).token;
    moderatorToken = (await createUser('moderator', UserRole.MODERATOR, true)).token;
    studentToken = (await createUser('student', UserRole.STUDENT, true)).token;
  });

  afterAll(async () => {
    if (app) {
      await cleanup();
      await app.close();
    }
  });

  it('[OV-1] chỉ Quản trị viên xem được tổng quan (chưa đăng nhập 401; sinh viên và Kiểm duyệt viên 403)', async () => {
    await overview().expect(401);
    await overview(studentToken).expect(403);
    await overview(moderatorToken).expect(403);
    await overview(adminToken).expect(200);
  });

  it('[OV-2] đúng năm nhóm của UC54 theo thứ tự cố định, không có chỉ số ngoài UC54', async () => {
    const res = await overview(adminToken).expect(200);

    const body = res.body as AdminOverviewDto;
    expect(body.groups.map((g) => g.key)).toEqual([
      OverviewGroupKey.USERS,
      OverviewGroupKey.COMPANIES,
      OverviewGroupKey.JOBS,
      OverviewGroupKey.APPLICATIONS,
      OverviewGroupKey.REPORTS,
    ]);
    expect(Number.isNaN(Date.parse(body.generatedAt))).toBe(false);
  });

  it('[OV-3] nhóm Người dùng khớp truy vấn trực tiếp vào bảng User (tổng và từng vai trò)', async () => {
    const res = await overview(adminToken).expect(200);
    const users = group(res.body as AdminOverviewDto, OverviewGroupKey.USERS);

    expect(users.status).toBe(OverviewGroupStatus.AVAILABLE);
    expect(users.total).toBe(await prisma.user.count());
    for (const role of Object.values(UserRole)) {
      const item = users.breakdown.find((b) => b.key === role);
      expect(item).toBeDefined();
      expect(item.count).toBe(await prisma.user.count({ where: { role } }));
    }
  });

  it('[OV-4] nhóm Báo cáo vi phạm khớp truy vấn trực tiếp vào bảng ViolationReport (tổng và từng trạng thái)', async () => {
    const res = await overview(adminToken).expect(200);
    const reports = group(res.body as AdminOverviewDto, OverviewGroupKey.REPORTS);

    expect(reports.status).toBe(OverviewGroupStatus.AVAILABLE);
    expect(reports.total).toBe(await prisma.violationReport.count());
    for (const status of Object.values(ViolationReportStatus)) {
      const item = reports.breakdown.find((b) => b.key === status);
      expect(item).toBeDefined();
      expect(item.count).toBe(await prisma.violationReport.count({ where: { status } }));
    }
  });

  it('[OV-5] số liệu thay đổi theo dữ liệu thật (không cache, không hardcode)', async () => {
    const before = await overview(adminToken).expect(200);
    const usersBefore = group(before.body as AdminOverviewDto, OverviewGroupKey.USERS);
    const reportsBefore = group(before.body as AdminOverviewDto, OverviewGroupKey.REPORTS);

    const extra = await createUser('extra-student', UserRole.STUDENT, false);
    const report = await prisma.violationReport.create({
      data: {
        reporterId: extra.id,
        targetType: 'STUDENT',
        targetId: extra.id,
        reason: 'SPAM',
        description: 'Báo cáo kiểm thử đối soát số liệu tổng quan',
      },
    });

    const after = await overview(adminToken).expect(200);
    const usersAfter = group(after.body as AdminOverviewDto, OverviewGroupKey.USERS);
    const reportsAfter = group(after.body as AdminOverviewDto, OverviewGroupKey.REPORTS);

    expect(usersAfter.total).toBe(usersBefore.total + 1);
    expect(usersAfter.breakdown.find((b) => b.key === 'STUDENT')?.count).toBe(
      usersBefore.breakdown.find((b) => b.key === 'STUDENT')!.count + 1,
    );
    expect(reportsAfter.total).toBe(reportsBefore.total + 1);
    expect(reportsAfter.breakdown.find((b) => b.key === 'SUBMITTED')?.count).toBe(
      reportsBefore.breakdown.find((b) => b.key === 'SUBMITTED')!.count + 1,
    );

    await prisma.violationReport.delete({ where: { id: report.id } });
    const restored = await overview(adminToken).expect(200);
    expect(group(restored.body as AdminOverviewDto, OverviewGroupKey.REPORTS).total).toBe(reportsBefore.total);
  });

  it('[OV-6] mỗi nhóm hoặc có số thật (tổng bằng tổng các phần) hoặc UNAVAILABLE kèm lý do, không có số giả', async () => {
    const res = await overview(adminToken).expect(200);

    const body = res.body as AdminOverviewDto;
    for (const g of body.groups) {
      if (g.status === OverviewGroupStatus.AVAILABLE) {
        expect(typeof g.total).toBe('number');
        expect(g.breakdown.reduce((sum, item) => sum + item.count, 0)).toBe(g.total);
        expect(g.unavailableReason).toBeNull();
      } else {
        expect(g.status).toBe(OverviewGroupStatus.UNAVAILABLE);
        expect(g.total).toBeNull();
        expect(g.breakdown).toEqual([]);
        expect(typeof g.unavailableReason).toBe('string');
        expect(g.unavailableReason.length).toBeGreaterThan(0);
      }
    }
  });

  it('[OV-7] module khác đăng ký nguồn của mình thì nhóm tương ứng hiển thị số thật (cơ chế cho M03/M04)', async () => {
    app.get(OverviewSourceRegistry, { strict: false }).register({
      key: OverviewGroupKey.APPLICATIONS,
      collect: async () => ({
        total: 3,
        breakdownLabel: 'Theo trạng thái',
        breakdown: [
          { key: 'SUBMITTED', label: 'Đã nộp', count: 2 },
          { key: 'ACCEPTED', label: 'Được nhận', count: 1 },
        ],
      }),
    });

    const res = await overview(adminToken).expect(200);
    const applications = group(res.body, OverviewGroupKey.APPLICATIONS);

    expect(applications.status).toBe(OverviewGroupStatus.AVAILABLE);
    expect(applications.total).toBe(3);
    expect(applications.breakdown).toHaveLength(2);
  });
});
