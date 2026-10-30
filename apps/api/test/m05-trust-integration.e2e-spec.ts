import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import {
  ModerationTargetType,
  NotificationEventType,
  UserRole,
  UserStatus,
  ViolationTargetType,
} from '@campusjob/contracts';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { GlobalExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';
import {
  INotificationEmailSender,
  NOTIFICATION_EMAIL_SENDER_TOKEN,
  NotificationEmailMessage,
} from '../src/modules/notifications/application/ports/notification-email-sender.port';
import {
  INotificationPublisher,
  NOTIFICATION_PUBLISHER_TOKEN,
} from '../src/modules/notifications/application/ports/notification-publisher.port';
import { RetryPendingNotificationEmailsUseCase } from '../src/modules/notifications/application/use-cases/retry-pending-notification-emails.use-case';
import { buildNotificationContent } from '../src/modules/notifications/domain/templates/notification-content';
import {
  IModerationQueue,
  MODERATION_QUEUE_TOKEN,
} from '../src/modules/moderation/application/ports/moderation-queue.port';
import {
  IModerationTargetHandler,
  ModerationDecisionContext,
  ModerationTargetHandlerRegistry,
} from '../src/modules/moderation/application/ports/moderation-target-handler.port';
import { ResyncModerationDecisionsUseCase } from '../src/modules/moderation/application/use-cases/resync-moderation-decisions.use-case';
import { ReportTargetResolverRegistry } from '../src/modules/reports/application/ports/report-target-resolver.port';
import { ReviewSourcesRegistry } from '../src/modules/reviews/application/ports/review-sources.port';
import { CompanySanctionHandlerRegistry } from '../src/modules/sanctions/application/ports/company-sanction-handler.port';
import {
  ISanctionQuery,
  SANCTION_QUERY_TOKEN,
} from '../src/modules/sanctions/application/ports/sanction-query.port';

const request = supertest;

/**
 * S2-M05-06: Trust Integration (C-16 → C-20).
 *
 * Kiểm thử xuyên module trên AppModule thật + database thật:
 *   báo cáo (C-17) → kiểm duyệt (C-16) → chế tài (C-19) → thông báo (C-20), cùng đánh giá (C-18).
 *
 * Ranh giới:
 * - M01 (tài khoản/JWT) và các module M05 chạy THẬT.
 * - Email được thay bằng bộ gửi giả (ghi lại thư) để kiểm tra "đúng người nhận" và "email lỗi không mất sự kiện"
 *   mà không phụ thuộc Mailpit.
 * - M03 (doanh nghiệp/tin tuyển dụng) và M04 (hồ sơ ứng tuyển) CHƯA nối vào AppModule, nên các adapter theo contract
 *   (ReviewSourcesRegistry, CompanySanctionHandlerRegistry, ReportTargetResolverRegistry, ModerationTargetHandlerRegistry)
 *   được đăng ký bằng đối tượng giả ngay trong test. Khi M03/M04 nối thật, thay các đối tượng giả này bằng adapter thật.
 */

class FakeEmailSender implements INotificationEmailSender {
  sent: NotificationEmailMessage[] = [];
  failing = false;

  async send(message: NotificationEmailMessage): Promise<void> {
    if (this.failing) {
      throw new Error('SMTP down (simulated)');
    }
    this.sent.push(message);
  }

  to(email: string): NotificationEmailMessage[] {
    return this.sent.filter((m) => m.to === email);
  }

  reset(): void {
    this.sent = [];
    this.failing = false;
  }
}

interface TestUser {
  id: string;
  email: string;
  token: string;
}

const PREFIX = 'm05i-';
const PASSWORD = 'Password123!@#$';
const RUN_ID = Date.now().toString(36);
const titleOf = (eventType: NotificationEventType) => buildNotificationContent(eventType, {}).title;

describe('S2-M05-06: Trust Integration (report → moderation → sanction → notification)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emailSender = new FakeEmailSender();
  let seq = 0;
  const companyIds: string[] = [];
  const jobIds: string[] = [];

  let mod1: TestUser;
  let mod2: TestUser;
  let admin: TestUser;
  let admin2: TestUser;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  // ---------- fixtures ----------
  async function newUser(label: string, role: UserRole, login = false): Promise<TestUser> {
    const email = `${PREFIX}${label}-${RUN_ID}-${++seq}@campusjob.local`;
    const user = await prisma.user.create({
      data: {
        email,
        fullName: `M05 ${label}`,
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
    return { id: user.id, email, token };
  }

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    const reports = await prisma.violationReport.findMany({
      where: { reporterId: { in: userIds } },
      select: { id: true },
    });
    const reportIds = reports.map((r) => r.id);
    const reviews = await prisma.review.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
    const reviewIds = reviews.map((r) => r.id);

    await prisma.sanction.deleteMany({ where: { reportId: { in: reportIds } } });
    await prisma.moderationItem.deleteMany({ where: { targetId: { in: [...reportIds, ...reviewIds, ...jobIds] } } });
    await prisma.review.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.violationReport.deleteMany({ where: { id: { in: reportIds } } });
    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // ---------- API helpers ----------
  const fileReport = (reporter: TestUser, targetType: string, targetId: string, extra: Record<string, unknown> = {}) =>
    api()
      .post('/api/v1/reports')
      .set(bearer(reporter.token))
      .send({
        targetType,
        targetId,
        reason: 'FRAUD',
        description: 'Mô tả vi phạm đủ dài để hợp lệ theo quy tắc của hệ thống',
        evidence: [{ url: 'https://example.com/evidence.png' }],
        ...extra,
      });

  const decide = (moderator: TestUser, itemId: string, body: Record<string, unknown>) =>
    api().post(`/api/v1/moderation/items/${itemId}/decision`).set(bearer(moderator.token)).send(body);

  const sanction = (adminUser: TestUser, body: Record<string, unknown>) =>
    api().post('/api/v1/sanctions').set(bearer(adminUser.token)).send(body);

  const latestItem = async (targetType: ModerationTargetType, targetId: string) => {
    const item = await prisma.moderationItem.findFirst({
      where: { targetType, targetId },
      orderBy: { round: 'desc' },
    });
    if (!item) throw new Error(`No moderation item for ${targetType}:${targetId}`);
    return item;
  };

  const countNotifications = (recipientId: string, eventType?: NotificationEventType) =>
    prisma.notification.count({ where: { recipientId, ...(eventType ? { eventType } : {}) } });

  /** Tìm một mục trong danh sách phân trang (hàng đợi sắp cũ nhất trước nên có thể không nằm ở trang đầu). */
  async function findInPages<T extends Record<string, unknown>>(
    path: string,
    token: string,
    predicate: (item: T) => boolean,
  ): Promise<T | undefined> {
    for (let page = 1; page <= 50; page++) {
      const separator = path.includes('?') ? '&' : '?';
      const res = await api()
        .get(`/api/v1${path}${separator}page=${page}&limit=50`)
        .set(bearer(token))
        .expect(200);
      const data: T[] = res.body.data;
      const hit = data.find(predicate);
      if (hit) return hit;
      if (!res.body.meta.hasNextPage) return undefined;
    }
    return undefined;
  }

  const payloadOf = async (recipientId: string, eventType: NotificationEventType): Promise<Record<string, unknown>> => {
    const n = await prisma.notification.findFirstOrThrow({ where: { recipientId, eventType }, orderBy: { createdAt: 'desc' } });
    const payload: unknown = n.payload ?? {};
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return {};
    return { ...payload };
  };

  /** Báo cáo mới → Kiểm duyệt viên kết luận "có căn cứ". Trả về báo cáo ở trạng thái SUBSTANTIATED. */
  async function substantiatedReport(reporter: TestUser, targetType: string, targetId: string) {
    const created = await fileReport(reporter, targetType, targetId).expect(201);
    const item = await latestItem(ModerationTargetType.REPORT, created.body.id);
    await decide(mod1, item.id, { decision: 'SUBSTANTIATE', reason: 'Có bằng chứng xác thực' }).expect(200);
    return created.body.id as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NOTIFICATION_EMAIL_SENDER_TOKEN)
      .useValue(emailSender)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    await cleanup();
    mod1 = await newUser('mod1', UserRole.MODERATOR, true);
    mod2 = await newUser('mod2', UserRole.MODERATOR, true);
    admin = await newUser('admin', UserRole.ADMIN, true);
    admin2 = await newUser('admin2', UserRole.ADMIN, true);
  });

  afterAll(async () => {
    if (app) {
      await cleanup();
      await app.close();
    }
  });

  // =====================================================================================
  describe('A. Luồng đầy đủ: báo cáo sinh viên → kiểm duyệt → khóa ứng tuyển → thông báo', () => {
    let reporter: TestUser;
    let target: TestUser;
    let bystander: TestUser;
    let reportId: string;
    let itemId: string;
    let sanctionId: string;

    beforeAll(async () => {
      emailSender.reset();
      reporter = await newUser('a-employer', UserRole.EMPLOYER, true);
      target = await newUser('a-student', UserRole.STUDENT, true);
      bystander = await newUser('a-bystander', UserRole.STUDENT, true);
    });

    it('[TM-A1] nhà tuyển dụng báo cáo sinh viên → 201, chờ thẩm tra, người báo cáo nhận đúng 1 thông báo REPORT_RECEIVED', async () => {
      const res = await fileReport(reporter, 'STUDENT', target.id).expect(201);
      reportId = res.body.id;

      expect(res.body.status).toBe('UNDER_REVIEW');
      expect(res.body.evidenceCount).toBe(1);
      expect(await countNotifications(reporter.id, NotificationEventType.REPORT_RECEIVED)).toBe(1);
      expect((await payloadOf(reporter.id, NotificationEventType.REPORT_RECEIVED)).reportId).toBe(reportId);
    });

    it('[TM-A2] báo cáo trùng bị chặn: không tạo thêm báo cáo, mục kiểm duyệt hay thông báo', async () => {
      const res = await fileReport(reporter, 'STUDENT', target.id).expect(409);
      expect(res.body.code).toBe('REPORT_DUPLICATE');

      expect(await prisma.violationReport.count({ where: { reporterId: reporter.id, targetId: target.id } })).toBe(1);
      expect(await prisma.moderationItem.count({ where: { targetType: 'REPORT', targetId: reportId } })).toBe(1);
      expect(await countNotifications(reporter.id, NotificationEventType.REPORT_RECEIVED)).toBe(1);
    });

    it('[TM-A3] báo cáo xuất hiện trong hàng đợi của Kiểm duyệt viên, sinh viên không xem được hàng đợi', async () => {
      const found = await findInPages(
        '/moderation/queue?targetType=REPORT&status=PENDING',
        mod1.token,
        (i) => i.targetId === reportId,
      );
      expect(found).toBeDefined();
      itemId = found.id;

      await api().get('/api/v1/moderation/queue').set(bearer(bystander.token)).expect(403);
    });

    it('[TM-A4] Kiểm duyệt viên xem được báo cáo kèm bằng chứng; người báo cáo không dùng được API thẩm tra', async () => {
      const res = await api().get(`/api/v1/reports/review/${reportId}`).set(bearer(mod1.token)).expect(200);
      expect(res.body.reporterId).toBe(reporter.id);
      expect(res.body.evidence).toHaveLength(1);

      await api().get(`/api/v1/reports/review/${reportId}`).set(bearer(reporter.token)).expect(403);
    });

    it('[TM-A5] chỉ người được giao mới xử lý mục kiểm duyệt', async () => {
      await api().post(`/api/v1/moderation/items/${itemId}/claim`).set(bearer(mod1.token)).expect(200);

      const blocked = await decide(mod2, itemId, { decision: 'SUBSTANTIATE', reason: 'Thử xử lý hộ' }).expect(403);
      expect(blocked.body.code).toBe('MODERATION_NOT_ASSIGNED');
      const claim = await api().post(`/api/v1/moderation/items/${itemId}/claim`).set(bearer(mod2.token)).expect(409);
      expect(claim.body.code).toBe('MODERATION_ALREADY_ASSIGNED');
    });

    it('[TM-A6] chưa có kết luận "có căn cứ" thì Admin không thể áp chế tài hay đóng báo cáo', async () => {
      const apply = await sanction(admin, { reportId, type: 'WARNING', reason: 'Quá sớm' }).expect(409);
      expect(apply.body.code).toBe('SANCTION_REPORT_NOT_SUBSTANTIATED');
      await api()
        .post(`/api/v1/sanctions/reports/${reportId}/close`)
        .set(bearer(admin.token))
        .send({ reason: 'Quá sớm' })
        .expect(409);

      expect(await prisma.sanction.count({ where: { reportId } })).toBe(0);
    });

    it('[TM-A7] kết luận sơ bộ chỉ được ghi một lần; báo cáo chuyển sang SUBSTANTIATED và vẫn chưa có chế tài', async () => {
      const res = await decide(mod1, itemId, {
        decision: 'SUBSTANTIATE',
        reason: 'Bằng chứng khớp với mô tả',
        proposedAction: 'Đề xuất khóa tạm thời',
      }).expect(200);
      expect(res.body.decision.targetSynced).toBe(true);

      const second = await decide(admin, itemId, { decision: 'DISMISS', reason: 'Quyết định trùng' }).expect(409);
      expect(second.body.code).toBe('MODERATION_ALREADY_DECIDED');

      expect(await prisma.moderationDecision.count({ where: { itemId } })).toBe(1);
      const stored = await prisma.moderationDecision.findFirstOrThrow({ where: { itemId } });
      expect(stored.decision).toBe('SUBSTANTIATE');
      expect(stored.reviewerId).toBe(mod1.id);
      expect(stored.proposedAction).toBe('Đề xuất khóa tạm thời');
      const report = await prisma.violationReport.findUniqueOrThrow({ where: { id: reportId } });
      expect(report.status).toBe('SUBSTANTIATED');
      // Kết luận sơ bộ không áp chế tài và không báo "đã xử lý" cho người báo cáo.
      expect(await prisma.sanction.count({ where: { reportId } })).toBe(0);
      expect(await countNotifications(reporter.id, NotificationEventType.REPORT_RESOLVED)).toBe(0);
    });

    it('[TM-A8] chỉ Quản trị viên được áp chế tài (Moderator, nhà tuyển dụng, sinh viên đều bị 403)', async () => {
      const body = { reportId, type: 'WARNING', reason: 'Thử vượt quyền' };
      await sanction(mod1, body).expect(403);
      await sanction(reporter, body).expect(403);
      await sanction(bystander, body).expect(403);
      expect(await prisma.sanction.count({ where: { reportId } })).toBe(0);
    });

    it('[TM-A9] Admin thấy báo cáo đã có căn cứ trong danh sách chờ phán quyết', async () => {
      const found = await findInPages('/sanctions/reports', admin.token, (r) => r.id === reportId);
      expect(found).toBeDefined();
    });

    it('[TM-A10] Admin khóa quyền ứng tuyển: lưu chế tài kèm lịch sử, đóng báo cáo, ghi audit', async () => {
      const res = await sanction(admin, {
        reportId,
        type: 'APPLICATION_LOCK',
        reason: 'Khai gian thông tin hồ sơ',
        durationDays: 7,
      }).expect(201);
      sanctionId = res.body.id;

      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.endsAt).not.toBeNull();
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].action).toBe('APPLIED');

      const report = await prisma.violationReport.findUniqueOrThrow({ where: { id: reportId } });
      expect(report.status).toBe('RESOLVED');
      expect(await prisma.auditLog.count({ where: { entityId: sanctionId, action: 'SANCTION_APPLIED' } })).toBe(1);

      // Chế tài liên kết đúng báo cáo, đúng đối tượng bị xử lý và đúng người ra quyết định.
      const stored = await prisma.sanction.findUniqueOrThrow({ where: { id: sanctionId } });
      expect(stored.reportId).toBe(reportId);
      expect(stored.targetType).toBe('STUDENT');
      expect(stored.targetId).toBe(target.id);
      expect(stored.imposedBy).toBe(admin.id);
    });

    it('[TM-A11] thông báo đến đúng người, đúng một lần (kể cả email); người không liên quan không nhận gì', async () => {
      expect(await countNotifications(target.id, NotificationEventType.SANCTION_APPLIED)).toBe(1);
      expect(await countNotifications(reporter.id, NotificationEventType.REPORT_RESOLVED)).toBe(1);
      expect(await countNotifications(bystander.id)).toBe(0);

      const toTarget = emailSender.to(target.email);
      expect(toTarget).toHaveLength(1);
      expect(toTarget[0].subject).toBe(titleOf(NotificationEventType.SANCTION_APPLIED));
      const toReporter = emailSender.to(reporter.email).filter((m) => m.subject === titleOf(NotificationEventType.REPORT_RESOLVED));
      expect(toReporter).toHaveLength(1);
      expect(emailSender.to(bystander.email)).toHaveLength(0);

      // Mỗi thông báo mang liên kết tới đúng đối tượng để giao diện điều hướng.
      const toTargetPayload = await payloadOf(target.id, NotificationEventType.SANCTION_APPLIED);
      expect(toTargetPayload.sanctionId).toBe(sanctionId);
      expect(toTargetPayload.reportId).toBe(reportId);
      expect(toTargetPayload.sanctionTypeCode).toBe('APPLICATION_LOCK');
      const toReporterPayload = await payloadOf(reporter.id, NotificationEventType.REPORT_RESOLVED);
      expect(toReporterPayload.reportId).toBe(reportId);
      expect(toReporterPayload.sanctionId).toBe(sanctionId);
      expect(toReporterPayload.outcome).toBe('SANCTIONED');
    });

    it('[TM-A12] áp lại cho cùng báo cáo không đổi gì: không thêm chế tài, không thêm thông báo', async () => {
      const res = await sanction(admin, { reportId, type: 'WARNING', reason: 'Áp lần hai' }).expect(409);
      expect(res.body.code).toBe('SANCTION_REPORT_ALREADY_RESOLVED');

      expect(await prisma.sanction.count({ where: { reportId } })).toBe(1);
      expect(await countNotifications(target.id, NotificationEventType.SANCTION_APPLIED)).toBe(1);
      expect(await countNotifications(reporter.id, NotificationEventType.REPORT_RESOLVED)).toBe(1);
    });

    it('[TM-A13] sinh viên thấy chế tài của mình; M04 đọc được trạng thái khóa qua cổng ISanctionQuery', async () => {
      const mine = await api().get('/api/v1/sanctions/mine').set(bearer(target.token)).expect(200);
      expect(mine.body.data).toHaveLength(1);
      expect(mine.body.data[0].type).toBe('APPLICATION_LOCK');
      expect(mine.body.data[0].status).toBe('ACTIVE');

      const others = await api().get('/api/v1/sanctions/mine').set(bearer(bystander.token)).expect(200);
      expect(others.body.data).toHaveLength(0);

      const query = app.get<ISanctionQuery>(SANCTION_QUERY_TOKEN, { strict: false });
      expect((await query.getApplicationLock(target.id)).locked).toBe(true);
      expect((await query.getApplicationLock(bystander.id)).locked).toBe(false);
    });

    it('[TM-A14] API thông báo chỉ trả thông báo của chính mình và đánh dấu đã đọc hoạt động đúng', async () => {
      const list = await api().get('/api/v1/notifications').set(bearer(target.token)).expect(200);
      expect(list.body.data.map((n: { eventType: string }) => n.eventType)).toEqual(['SANCTION_APPLIED']);
      const notificationId = list.body.data[0].id;

      const unread = await api().get('/api/v1/notifications/unread-count').set(bearer(target.token)).expect(200);
      expect(unread.body.unreadCount).toBe(1);

      await api().patch(`/api/v1/notifications/${notificationId}/read`).set(bearer(bystander.token)).expect(404);
      await api().patch(`/api/v1/notifications/${notificationId}/read`).set(bearer(target.token)).expect(200);

      const after = await api().get('/api/v1/notifications/unread-count').set(bearer(target.token)).expect(200);
      expect(after.body.unreadCount).toBe(0);
    });

    it('[TM-A15] Admin gỡ chế tài: lịch sử được giữ, khóa ứng tuyển được nhả, gỡ lần hai bị từ chối', async () => {
      const res = await api()
        .post(`/api/v1/sanctions/${sanctionId}/lift`)
        .set(bearer(admin.token))
        .send({ reason: 'Khiếu nại thành công' })
        .expect(200);
      expect(res.body.status).toBe('LIFTED');
      expect(res.body.events.map((e: { action: string }) => e.action)).toEqual(['APPLIED', 'LIFTED']);

      const query = app.get<ISanctionQuery>(SANCTION_QUERY_TOKEN, { strict: false });
      expect((await query.getApplicationLock(target.id)).locked).toBe(false);

      const again = await api()
        .post(`/api/v1/sanctions/${sanctionId}/lift`)
        .set(bearer(admin.token))
        .send({ reason: 'Gỡ lần hai' })
        .expect(409);
      expect(again.body.code).toBe('SANCTION_NOT_ACTIVE');
      expect(await prisma.auditLog.count({ where: { entityId: sanctionId, action: 'SANCTION_LIFTED' } })).toBe(1);
    });

    it('[TM-A16] sau khi báo cáo cũ đã phán quyết, người báo cáo được gửi báo cáo mới về cùng đối tượng', async () => {
      await fileReport(reporter, 'STUDENT', target.id).expect(201);
    });
  });

  // =====================================================================================
  describe('B. Chống quyết định và thông báo trùng khi thao tác đồng thời', () => {
    beforeAll(() => emailSender.reset());

    it('[TM-B1] hai Kiểm duyệt viên quyết định cùng lúc một mục: chỉ một quyết định được ghi', async () => {
      const reporter = await newUser('b1-employer', UserRole.EMPLOYER, true);
      const target = await newUser('b1-student', UserRole.STUDENT);
      const created = await fileReport(reporter, 'STUDENT', target.id).expect(201);
      const item = await latestItem(ModerationTargetType.REPORT, created.body.id);

      const results = await Promise.all([
        decide(mod1, item.id, { decision: 'DISMISS', reason: 'Không đủ căn cứ (người 1)' }),
        decide(mod2, item.id, { decision: 'DISMISS', reason: 'Không đủ căn cứ (người 2)' }),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await prisma.moderationDecision.count({ where: { itemId: item.id } })).toBe(1);
    });

    it('[TM-B2] hai Admin áp chế tài cùng lúc cho một báo cáo: một chế tài, mỗi bên nhận đúng một thông báo', async () => {
      const reporter = await newUser('b2-employer', UserRole.EMPLOYER, true);
      const target = await newUser('b2-student', UserRole.STUDENT);
      const reportId = await substantiatedReport(reporter, 'STUDENT', target.id);

      const body = { reportId, type: 'WARNING', reason: 'Cảnh cáo vì vi phạm' };
      const results = await Promise.all([sanction(admin, body), sanction(admin2, body)]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await prisma.sanction.count({ where: { reportId } })).toBe(1);
      expect(await countNotifications(target.id, NotificationEventType.SANCTION_APPLIED)).toBe(1);
      expect(await countNotifications(reporter.id, NotificationEventType.REPORT_RESOLVED)).toBe(1);
      expect(emailSender.to(target.email)).toHaveLength(1);
    });

    it('[TM-B3] phát lại cùng một sự kiện (cùng dedupeKey) chỉ lưu và gửi email một lần', async () => {
      const recipient = await newUser('b3-student', UserRole.STUDENT);
      const publisher = app.get<INotificationPublisher>(NOTIFICATION_PUBLISHER_TOKEN, { strict: false });
      const event = {
        eventType: NotificationEventType.SANCTION_APPLIED,
        recipientId: recipient.id,
        payload: { sanctionType: 'cảnh cáo', reason: 'Thử phát lại' },
        dedupeKey: `integration:${RUN_ID}:${recipient.id}`,
      };

      expect((await publisher.publish(event)).outcome).toBe('CREATED');
      expect((await publisher.publish(event)).outcome).toBe('DUPLICATE');

      expect(await countNotifications(recipient.id)).toBe(1);
      expect(emailSender.to(recipient.email)).toHaveLength(1);
    });
  });

  // =====================================================================================
  describe('C. Báo cáo bị bác bỏ hoặc đóng không xử phạt', () => {
    beforeAll(() => emailSender.reset());

    it('[TM-C1] báo cáo bị bác bỏ thì không thể áp chế tài, người báo cáo có thể gửi lại', async () => {
      const reporter = await newUser('c1-employer', UserRole.EMPLOYER, true);
      const target = await newUser('c1-student', UserRole.STUDENT);
      const created = await fileReport(reporter, 'STUDENT', target.id).expect(201);
      const item = await latestItem(ModerationTargetType.REPORT, created.body.id);

      await decide(mod1, item.id, { decision: 'DISMISS', reason: 'Không đủ căn cứ' }).expect(200);
      expect((await prisma.violationReport.findUniqueOrThrow({ where: { id: created.body.id } })).status).toBe('DISMISSED');

      const apply = await sanction(admin, { reportId: created.body.id, type: 'WARNING', reason: 'Vẫn thử' }).expect(409);
      expect(apply.body.code).toBe('SANCTION_REPORT_NOT_SUBSTANTIATED');
      expect(await prisma.sanction.count({ where: { reportId: created.body.id } })).toBe(0);
      expect(await countNotifications(target.id)).toBe(0);

      await fileReport(reporter, 'STUDENT', target.id).expect(201);
    });

    it('[TM-C2] Admin đóng báo cáo không xử phạt: chỉ người báo cáo được thông báo, đối tượng không nhận gì', async () => {
      const reporter = await newUser('c2-employer', UserRole.EMPLOYER, true);
      const target = await newUser('c2-student', UserRole.STUDENT);
      const reportId = await substantiatedReport(reporter, 'STUDENT', target.id);

      await api()
        .post(`/api/v1/sanctions/reports/${reportId}/close`)
        .set(bearer(admin.token))
        .send({ reason: 'Đã nhắc nhở, không xử phạt' })
        .expect(200);

      expect((await prisma.violationReport.findUniqueOrThrow({ where: { id: reportId } })).status).toBe('RESOLVED');
      expect(await prisma.sanction.count({ where: { reportId } })).toBe(0);
      expect(await countNotifications(reporter.id, NotificationEventType.REPORT_RESOLVED)).toBe(1);
      const closedPayload = await payloadOf(reporter.id, NotificationEventType.REPORT_RESOLVED);
      expect(closedPayload.reportId).toBe(reportId);
      expect(closedPayload.outcome).toBe('CLOSED_WITHOUT_SANCTION');
      expect(await countNotifications(target.id)).toBe(0);
      expect(emailSender.to(target.email)).toHaveLength(0);

      const again = await api()
        .post(`/api/v1/sanctions/reports/${reportId}/close`)
        .set(bearer(admin.token))
        .send({ reason: 'Đóng lần hai' })
        .expect(409);
      expect(again.body.code).toBe('SANCTION_REPORT_ALREADY_RESOLVED');
      expect(await countNotifications(reporter.id, NotificationEventType.REPORT_RESOLVED)).toBe(1);
    });
  });

  // =====================================================================================
  describe('D. Ngưỡng cảnh cáo và không chồng chế tài', () => {
    it('[TM-D1] đủ ngưỡng cảnh cáo thì buộc khóa ứng tuyển; đang bị khóa thì không khóa chồng', async () => {
      const reporter = await newUser('d-employer', UserRole.EMPLOYER, true);
      const target = await newUser('d-student', UserRole.STUDENT);

      for (let i = 1; i <= 3; i++) {
        const reportId = await substantiatedReport(reporter, 'STUDENT', target.id);
        await sanction(admin, { reportId, type: 'WARNING', reason: `Cảnh cáo lần ${i}` }).expect(201);
      }

      const fourthId = await substantiatedReport(reporter, 'STUDENT', target.id);
      const escalated = await sanction(admin, { reportId: fourthId, type: 'WARNING', reason: 'Cảnh cáo lần 4' }).expect(409);
      expect(escalated.body.code).toBe('SANCTION_ESCALATION_REQUIRED');
      expect((await prisma.violationReport.findUniqueOrThrow({ where: { id: fourthId } })).status).toBe('SUBSTANTIATED');

      await sanction(admin, { reportId: fourthId, type: 'APPLICATION_LOCK', reason: 'Vi phạm lặp lại', durationDays: 30 }).expect(201);

      const fifthId = await substantiatedReport(reporter, 'STUDENT', target.id);
      const stacked = await sanction(admin, {
        reportId: fifthId,
        type: 'APPLICATION_LOCK',
        reason: 'Khóa chồng',
        durationDays: 30,
      }).expect(409);
      expect(stacked.body.code).toBe('SANCTION_ALREADY_ACTIVE');

      // Cảnh cáo vẫn bị chặn bởi ngưỡng (3 cảnh cáo còn hiệu lực), không phải bởi khóa.
      const warning = await sanction(admin, { reportId: fifthId, type: 'WARNING', reason: 'Cảnh cáo thêm' }).expect(409);
      expect(warning.body.code).toBe('SANCTION_ESCALATION_REQUIRED');
    });

    it('[TM-D2] thời hạn khóa ngoài khoảng cho phép bị từ chối và không ghi gì', async () => {
      const reporter = await newUser('d2-employer', UserRole.EMPLOYER, true);
      const target = await newUser('d2-student', UserRole.STUDENT);
      const reportId = await substantiatedReport(reporter, 'STUDENT', target.id);

      await sanction(admin, { reportId, type: 'APPLICATION_LOCK', reason: 'Thiếu thời hạn' }).expect(400);
      await sanction(admin, { reportId, type: 'APPLICATION_LOCK', reason: 'Quá dài', durationDays: 365 }).expect(400);
      expect(await prisma.sanction.count({ where: { reportId } })).toBe(0);
    });
  });

  // =====================================================================================
  describe('E. Email lỗi không làm mất sự kiện', () => {
    it('[TM-E1] chế tài vẫn được lưu và thông báo trong ứng dụng vẫn có; email gửi lại thành công sau đó', async () => {
      emailSender.reset();
      const reporter = await newUser('e-employer', UserRole.EMPLOYER, true);
      const target = await newUser('e-student', UserRole.STUDENT);
      const reportId = await substantiatedReport(reporter, 'STUDENT', target.id);

      emailSender.failing = true;
      await sanction(admin, { reportId, type: 'WARNING', reason: 'Cảnh cáo khi SMTP đang lỗi' }).expect(201);
      emailSender.failing = false;

      const failed = await prisma.notification.findFirstOrThrow({
        where: { recipientId: target.id, eventType: NotificationEventType.SANCTION_APPLIED },
      });
      expect(failed.emailStatus).toBe('FAILED');
      expect(failed.emailAttempts).toBe(1);
      expect(emailSender.to(target.email)).toHaveLength(0);
      // Sự kiện không mất: người dùng vẫn đọc được thông báo trong ứng dụng.
      expect(await countNotifications(target.id, NotificationEventType.SANCTION_APPLIED)).toBe(1);

      const retry = app.get(RetryPendingNotificationEmailsUseCase, { strict: false });
      const summary = await retry.execute(50, new Date(Date.now() + 10 * 60 * 1000));
      expect(summary.sent).toBeGreaterThanOrEqual(1);

      const sent = await prisma.notification.findUniqueOrThrow({ where: { id: failed.id } });
      expect(sent.emailStatus).toBe('SENT');
      expect(emailSender.to(target.email)).toHaveLength(1);
    });
  });

  // =====================================================================================
  describe('F. Đánh giá doanh nghiệp (adapter M03/M04 giả theo contract) và kiểm duyệt đánh giá', () => {
    const companyId = randomUUID();
    const jobId = randomUUID();
    const applications = new Map<string, { studentId: string; jobId: string; status: string }>();
    let owner: TestUser;
    let otherEmployer: TestUser;
    let student: TestUser;
    let stranger: TestUser;
    let reporter: TestUser;
    let applicationId: string;
    let reviewId: string;

    beforeAll(async () => {
      emailSender.reset();
      companyIds.push(companyId);
      owner = await newUser('f-owner', UserRole.EMPLOYER, true);
      otherEmployer = await newUser('f-other-employer', UserRole.EMPLOYER, true);
      student = await newUser('f-student', UserRole.STUDENT, true);
      stranger = await newUser('f-stranger', UserRole.STUDENT, true);
      reporter = await newUser('f-reporter', UserRole.STUDENT, true);

      const sources = app.get(ReviewSourcesRegistry, { strict: false });
      sources.registerApplicationSource({
        async getOwnedApplication(studentId: string, id: string) {
          const found = applications.get(id);
          return found && found.studentId === studentId
            ? { applicationId: id, jobId: found.jobId, status: found.status }
            : null;
        },
      });
      const company = { companyId, companyName: 'ACME Integration', ownerUserId: owner.id };
      sources.registerCompanyDirectory({
        async findByJob(id: string) {
          return id === jobId ? company : null;
        },
        async findByEmployer(userId: string) {
          return userId === owner.id ? company : null;
        },
      });

      applicationId = randomUUID();
      applications.set(applicationId, { studentId: student.id, jobId, status: 'SUBMITTED' });
    });

    const review = (token: string, body: Record<string, unknown>) =>
      api().post('/api/v1/reviews').set(bearer(token)).send(body);

    it('[TM-F1] chỉ hồ sơ đã có kết quả cuối mới được đánh giá, mỗi hồ sơ một đánh giá, và chỉ chủ hồ sơ mới đánh giá được', async () => {
      const early = await review(student.token, { applicationId, rating: 4 }).expect(409);
      expect(early.body.code).toBe('REVIEW_NOT_ELIGIBLE');

      applications.get(applicationId)!.status = 'ACCEPTED';
      const created = await review(student.token, { applicationId, rating: 4, comment: 'Quy trình rõ ràng' }).expect(201);
      reviewId = created.body.id;
      expect(created.body.visibility).toBe('VISIBLE');

      const dup = await review(student.token, { applicationId, rating: 5 }).expect(409);
      expect(dup.body.code).toBe('REVIEW_ALREADY_EXISTS');
      const foreign = await review(stranger.token, { applicationId, rating: 1 }).expect(404);
      expect(foreign.body.code).toBe('REVIEW_APPLICATION_NOT_FOUND');
      expect(await prisma.review.count({ where: { companyId } })).toBe(1);
    });

    it('[TM-F2] danh sách công khai ẩn danh người viết và có thống kê', async () => {
      const res = await api().get(`/api/v1/reviews/company/${companyId}`).expect(200);
      expect(res.body.summary.totalReviews).toBe(1);
      expect(res.body.summary.averageRating).toBe(4);
      expect(res.body.data).toHaveLength(1);
      expect(JSON.stringify(res.body)).not.toContain(student.id);
      expect(JSON.stringify(res.body)).not.toContain('studentId');
    });

    it('[TM-F3] doanh nghiệp phản hồi đúng một lần; nhà tuyển dụng khác không phản hồi được', async () => {
      await api()
        .post(`/api/v1/reviews/${reviewId}/reply`)
        .set(bearer(otherEmployer.token))
        .send({ content: 'Tôi không thuộc doanh nghiệp này' })
        .expect(404);

      const ok = await api()
        .post(`/api/v1/reviews/${reviewId}/reply`)
        .set(bearer(owner.token))
        .send({ content: 'Cảm ơn bạn đã góp ý' })
        .expect(201);
      expect(ok.body.reply.content).toBe('Cảm ơn bạn đã góp ý');

      const again = await api()
        .post(`/api/v1/reviews/${reviewId}/reply`)
        .set(bearer(owner.token))
        .send({ content: 'Phản hồi lần hai' })
        .expect(409);
      expect(again.body.code).toBe('REVIEW_ALREADY_REPLIED');
    });

    it('[TM-F4] báo cáo một đánh giá đưa cả mục báo cáo lẫn mục đánh giá vào hàng đợi kiểm duyệt', async () => {
      await fileReport(reporter, 'REVIEW', reviewId, { reason: 'INAPPROPRIATE_CONTENT' }).expect(201);

      const reviewItem = await latestItem(ModerationTargetType.REVIEW, reviewId);
      expect(reviewItem.status).toBe('PENDING');
      const queued = await findInPages(
        '/moderation/queue?targetType=REVIEW&status=PENDING',
        mod1.token,
        (i) => i.targetId === reviewId,
      );
      expect(queued).toBeDefined();
    });

    it('[TM-F5] ẩn đánh giá: biến mất khỏi danh sách công khai và của nhà tuyển dụng, tác giả vẫn thấy trạng thái ẩn', async () => {
      const item = await latestItem(ModerationTargetType.REVIEW, reviewId);
      const res = await decide(mod1, item.id, { decision: 'HIDE', reason: 'Ngôn từ không phù hợp' }).expect(200);
      expect(res.body.decision.targetSynced).toBe(true);

      const publicList = await api().get(`/api/v1/reviews/company/${companyId}`).expect(200);
      expect(publicList.body.summary.totalReviews).toBe(0);
      expect(publicList.body.data).toHaveLength(0);

      const employerList = await api().get('/api/v1/reviews/employer').set(bearer(owner.token)).expect(200);
      expect(employerList.body.data).toHaveLength(0);

      const mine = await api().get('/api/v1/reviews/mine').set(bearer(student.token)).expect(200);
      expect(mine.body.data[0].visibility).toBe('HIDDEN');
    });

    it('[TM-F6] duyệt lại: đưa vào hàng đợi lần nữa không tạo trùng, khôi phục thì hiển thị lại', async () => {
      const queue = app.get<IModerationQueue>(MODERATION_QUEUE_TOKEN, { strict: false });

      const first = await queue.enqueue({ targetType: ModerationTargetType.REVIEW, targetId: reviewId });
      expect(first.outcome).toBe('CREATED');
      expect(first.round).toBe(2);
      const second = await queue.enqueue({ targetType: ModerationTargetType.REVIEW, targetId: reviewId });
      expect(second.outcome).toBe('ALREADY_PENDING');
      expect(second.itemId).toBe(first.itemId);

      await decide(mod1, first.itemId, { decision: 'RESTORE' }).expect(200);

      const publicList = await api().get(`/api/v1/reviews/company/${companyId}`).expect(200);
      expect(publicList.body.summary.totalReviews).toBe(1);
      expect(await prisma.moderationItem.count({ where: { targetType: 'REVIEW', targetId: reviewId } })).toBe(2);
    });
  });

  // =====================================================================================
  describe('G. Kiểm duyệt tin tuyển dụng → thông báo nhà tuyển dụng (handler M03 giả theo contract)', () => {
    const handled: ModerationDecisionContext[] = [];
    const handler: IModerationTargetHandler & { failing: boolean } = {
      failing: false,
      async applyDecision(context: ModerationDecisionContext) {
        if (handler.failing) throw new Error('M03 unavailable (simulated)');
        handled.push(context);
      },
    };
    let employer: TestUser;

    beforeAll(async () => {
      emailSender.reset();
      employer = await newUser('g-employer', UserRole.EMPLOYER);
      app.get(ModerationTargetHandlerRegistry, { strict: false }).register(ModerationTargetType.JOB, handler);
    });

    it('[TM-G1] đưa tin vào hàng đợi hai lần chỉ có một mục; duyệt tin → handler áp một lần, nhà tuyển dụng nhận đúng 1 thông báo', async () => {
      const jobId = randomUUID();
      jobIds.push(jobId);
      const queue = app.get<IModerationQueue>(MODERATION_QUEUE_TOKEN, { strict: false });

      const first = await queue.enqueue({
        targetType: ModerationTargetType.JOB,
        targetId: jobId,
        submitterId: employer.id,
        summary: 'Thực tập Backend NestJS',
      });
      const second = await queue.enqueue({ targetType: ModerationTargetType.JOB, targetId: jobId, submitterId: employer.id });
      expect(first.outcome).toBe('CREATED');
      expect(second.outcome).toBe('ALREADY_PENDING');
      expect(second.itemId).toBe(first.itemId);

      const res = await decide(mod1, first.itemId, { decision: 'APPROVE' }).expect(200);
      expect(res.body.decision.targetSynced).toBe(true);
      expect(handled.filter((c) => c.targetId === jobId)).toHaveLength(1);

      expect(await countNotifications(employer.id, NotificationEventType.JOB_APPROVED)).toBe(1);
      expect(emailSender.to(employer.email)).toHaveLength(1);
      const approvedPayload = await payloadOf(employer.id, NotificationEventType.JOB_APPROVED);
      expect(approvedPayload.jobId).toBe(jobId);
      expect(approvedPayload.moderationItemId).toBe(first.itemId);

      const dup = await decide(mod2, first.itemId, { decision: 'APPROVE' }).expect(409);
      expect(dup.body.code).toBe('MODERATION_ALREADY_DECIDED');
      expect(handled.filter((c) => c.targetId === jobId)).toHaveLength(1);
      expect(await countNotifications(employer.id, NotificationEventType.JOB_APPROVED)).toBe(1);
    });

    it('[TM-G2] duyệt lại sau khi sửa tin: từ chối bắt buộc có lý do, và lý do được gửi tới nhà tuyển dụng', async () => {
      const jobId = randomUUID();
      jobIds.push(jobId);
      const queue = app.get<IModerationQueue>(MODERATION_QUEUE_TOKEN, { strict: false });
      const item = await queue.enqueue({
        targetType: ModerationTargetType.JOB,
        targetId: jobId,
        submitterId: employer.id,
        summary: 'Thực tập Frontend',
      });

      const missing = await decide(mod1, item.itemId, { decision: 'REJECT' }).expect(400);
      expect(missing.body.code).toBe('MODERATION_REASON_REQUIRED');
      const wrongType = await decide(mod1, item.itemId, { decision: 'RESTORE' }).expect(400);
      expect(wrongType.body.code).toBe('MODERATION_DECISION_NOT_ALLOWED');

      await decide(mod1, item.itemId, { decision: 'REJECT', reason: 'Thiếu mô tả quyền lợi' }).expect(200);
      const note = await prisma.notification.findFirstOrThrow({
        where: { recipientId: employer.id, eventType: NotificationEventType.JOB_REJECTED },
      });
      expect(note.body).toContain('Thiếu mô tả quyền lợi');

      const resubmitted = await queue.enqueue({ targetType: ModerationTargetType.JOB, targetId: jobId, submitterId: employer.id });
      expect(resubmitted.outcome).toBe('CREATED');
      expect(resubmitted.round).toBe(2);
    });

    it('[TM-G3] module đích lỗi: quyết định vẫn được lưu (chưa đồng bộ) và được áp lại khi module đích phục hồi', async () => {
      const jobId = randomUUID();
      jobIds.push(jobId);
      const queue = app.get<IModerationQueue>(MODERATION_QUEUE_TOKEN, { strict: false });
      const item = await queue.enqueue({ targetType: ModerationTargetType.JOB, targetId: jobId, submitterId: employer.id });

      handler.failing = true;
      const res = await decide(mod1, item.itemId, { decision: 'HIDE', reason: 'Nội dung nhạy cảm' }).expect(200);
      handler.failing = false;
      expect(res.body.decision.targetSynced).toBe(false);
      expect(handled.filter((c) => c.targetId === jobId)).toHaveLength(0);

      const resync = await app.get(ResyncModerationDecisionsUseCase, { strict: false }).execute(100);
      expect(resync.synced).toBeGreaterThanOrEqual(1);

      expect(handled.filter((c) => c.targetId === jobId)).toHaveLength(1);
      const decision = await prisma.moderationDecision.findFirstOrThrow({ where: { itemId: item.itemId } });
      expect(decision.targetSyncedAt).not.toBeNull();
    });
  });

  // =====================================================================================
  describe('H. Đình chỉ doanh nghiệp (handler M03 giả theo contract)', () => {
    const companyId = randomUUID();
    const calls: { type: 'suspend' | 'unsuspend'; companyId: string; sanctionId: string }[] = [];
    let owner: TestUser;
    let reporter: TestUser;

    beforeAll(async () => {
      emailSender.reset();
      owner = await newUser('h-owner', UserRole.EMPLOYER);
      reporter = await newUser('h-student', UserRole.STUDENT, true);

      app.get(ReportTargetResolverRegistry, { strict: false }).register(ViolationTargetType.COMPANY, {
        async resolve(id: string) {
          return id === companyId ? { ownerUserId: owner.id, label: 'ACME Suspension' } : null;
        },
      });
      app.get(CompanySanctionHandlerRegistry, { strict: false }).register({
        async describe(id: string) {
          return id === companyId ? { ownerUserId: owner.id, name: 'ACME Suspension' } : null;
        },
        async suspend(id: string, sanctionId: string) {
          calls.push({ type: 'suspend', companyId: id, sanctionId });
        },
        async unsuspend(id: string, sanctionId: string) {
          calls.push({ type: 'unsuspend', companyId: id, sanctionId });
        },
      });
    });

    it('[TM-H1] sinh viên báo cáo doanh nghiệp → kiểm duyệt → Admin đình chỉ: handler gọi đúng một lần, chủ doanh nghiệp được thông báo', async () => {
      const reportId = await substantiatedReport(reporter, 'COMPANY', companyId);

      const res = await sanction(admin, {
        reportId,
        type: 'COMPANY_SUSPENSION',
        reason: 'Thu phí trái quy định',
      }).expect(201);
      const sanctionId = res.body.id;

      expect(calls.filter((c) => c.type === 'suspend')).toEqual([{ type: 'suspend', companyId, sanctionId }]);
      expect(await countNotifications(owner.id, NotificationEventType.SANCTION_APPLIED)).toBe(1);
      expect(await countNotifications(reporter.id, NotificationEventType.REPORT_RESOLVED)).toBe(1);

      await api()
        .post(`/api/v1/sanctions/${sanctionId}/lift`)
        .set(bearer(admin.token))
        .send({ reason: 'Đã khắc phục' })
        .expect(200);
      expect(calls.filter((c) => c.type === 'unsuspend')).toEqual([{ type: 'unsuspend', companyId, sanctionId }]);
    });

    it('[TM-H2] loại chế tài không phù hợp với đối tượng báo cáo bị từ chối', async () => {
      const reportId = await substantiatedReport(reporter, 'COMPANY', companyId);
      const res = await sanction(admin, { reportId, type: 'APPLICATION_LOCK', reason: 'Sai loại', durationDays: 7 }).expect(400);
      expect(res.body.code).toBe('SANCTION_TYPE_NOT_ALLOWED');
      expect(await prisma.sanction.count({ where: { reportId } })).toBe(0);
    });
  });
});
