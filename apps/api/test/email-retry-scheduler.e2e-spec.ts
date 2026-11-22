import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import {
  NotificationEmailStatus,
  NotificationEventType,
  UserRole,
  UserStatus,
} from '@campusjob/contracts';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import {
  INotificationEmailSender,
  NOTIFICATION_EMAIL_SENDER_TOKEN,
  NotificationEmailMessage,
} from '../src/modules/notifications/application/ports/notification-email-sender.port';
import { EmailRetrySchedulerService } from '../src/modules/notifications/application/services/email-retry-scheduler.service';
import { RetryPendingNotificationEmailsUseCase } from '../src/modules/notifications/application/use-cases/retry-pending-notification-emails.use-case';
import { DispatchNotificationEmailUseCase } from '../src/modules/notifications/application/use-cases/dispatch-notification-email.use-case';
import { MAX_EMAIL_ATTEMPTS } from '../src/modules/notifications/domain/policies/email-retry.policy';

/**
 * Controllable email sender to simulate SMTP connectivity, offline failures, and recovery.
 */
class ControllableEmailSender implements INotificationEmailSender {
  public shouldFail = false;
  public failureMessage = 'connect ECONNREFUSED 127.0.0.1:1026';
  public sentMessages: NotificationEmailMessage[] = [];

  async send(message: NotificationEmailMessage): Promise<void> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }
    this.sentMessages.push(message);
  }

  reset(): void {
    this.shouldFail = false;
    this.sentMessages = [];
  }
}

describe('R-M05-03: Email Retry Scheduler & Mailpit/SMTP Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let schedulerService: EmailRetrySchedulerService;
  let retryUseCase: RetryPendingNotificationEmailsUseCase;
  let dispatchUseCase: DispatchNotificationEmailUseCase;
  const emailSender = new ControllableEmailSender();

  const PREFIX = 'r-m05-03-test-';
  let testUserId: string;
  let testUserEmail: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NOTIFICATION_EMAIL_SENDER_TOKEN)
      .useValue(emailSender)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    schedulerService = app.get(EmailRetrySchedulerService);
    retryUseCase = app.get(RetryPendingNotificationEmailsUseCase);
    dispatchUseCase = app.get(DispatchNotificationEmailUseCase);

    // Create isolated test recipient
    testUserEmail = `${PREFIX}${randomUUID()}@campusjob.local`;
    const user = await prisma.user.create({
      data: {
        email: testUserEmail,
        fullName: 'Test Recipient R-M05-03',
        passwordHash: 'dummy_hash_for_scheduler_test',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    if (prisma && testUserId) {
      await prisma.notification.deleteMany({
        where: { recipientId: testUserId },
      });
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
    }
    await app?.close();
  });

  beforeEach(() => {
    emailSender.reset();
  });

  it('1. SMTP Offline: Gửi thất bại ghi nhận FAILED, bảo toàn thông báo in-app, đặt emailNextRetryAt', async () => {
    emailSender.shouldFail = true;

    // Tạo notification yêu cầu gửi email
    const notification = await prisma.notification.create({
      data: {
        recipientId: testUserId,
        eventType: NotificationEventType.JOB_APPROVED,
        title: 'Tin tuyển dụng đã được phê duyệt',
        body: 'Tin tuyển dụng của bạn đã được duyệt và công khai.',
        emailStatus: NotificationEmailStatus.PENDING,
      },
    });

    const now = new Date();
    const outcome = await dispatchUseCase.execute(notification.id, now);
    expect(outcome).toBe('FAILED');

    // Kiểm tra DB: thông báo in-app còn nguyên vẹn
    const updated = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(updated.emailStatus).toBe(NotificationEmailStatus.FAILED);
    expect(updated.emailAttempts).toBe(1);
    expect(updated.emailLastError).toContain('ECONNREFUSED');
    expect(updated.emailNextRetryAt).toBeInstanceOf(Date);
    // Lần 1: retry sau 1 phút
    expect(updated.emailNextRetryAt!.getTime()).toBeGreaterThan(now.getTime());
    expect(emailSender.sentMessages).toHaveLength(0);
  });

  it('2. Retry Scheduler: Không gửi lại khi chưa đến emailNextRetryAt', async () => {
    const now = new Date();
    // Tạo notification thất bại và hạn thử lại ở tương lai (+10 phút)
    const futureRetryAt = new Date(now.getTime() + 10 * 60 * 1000);
    const notification = await prisma.notification.create({
      data: {
        recipientId: testUserId,
        eventType: NotificationEventType.JOB_APPROVED,
        title: 'Tin tuyển dụng chờ retry',
        body: 'Nội dung thông báo',
        emailStatus: NotificationEmailStatus.FAILED,
        emailAttempts: 1,
        emailNextRetryAt: futureRetryAt,
      },
    });

    // Kích hoạt scheduler tại thời điểm `now`
    const summary = await retryUseCase.execute(50, now);
    // Candidate này chưa đến hạn nên không được pick
    const foundInBatch = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(foundInBatch.emailStatus).toBe(NotificationEmailStatus.FAILED);
    expect(foundInBatch.emailAttempts).toBe(1);
  });

  it('3. SMTP Recovery: Khi SMTP hoạt động lại và tới hạn retryAt, scheduler gửi thành công sang SENT', async () => {
    emailSender.shouldFail = false; // Phục hồi SMTP

    const now = new Date();
    const pastRetryAt = new Date(now.getTime() - 1000); // Đã tới hạn
    const notification = await prisma.notification.create({
      data: {
        recipientId: testUserId,
        eventType: NotificationEventType.JOB_APPROVED,
        title: 'Tin đã phục hồi SMTP',
        body: 'Nội dung gửi sau phục hồi',
        emailStatus: NotificationEmailStatus.FAILED,
        emailAttempts: 1,
        emailNextRetryAt: pastRetryAt,
      },
    });

    // Kích hoạt retry qua EmailRetrySchedulerService
    const result = await schedulerService.runRetryCheck('test-recovery-correlation');
    expect(result.status).toBe('COMPLETED');
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const sent = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(sent.emailStatus).toBe(NotificationEmailStatus.SENT);
    expect(sent.emailAttempts).toBe(2);
    expect(sent.emailSentAt).toBeInstanceOf(Date);
    expect(sent.emailNextRetryAt).toBeNull();
    expect(sent.emailLastError).toBeNull();
  });

  it('4. Dead-letter: Khi đạt MAX_EMAIL_ATTEMPTS (5), emailNextRetryAt chuyển null (FAILED vĩnh viễn)', async () => {
    emailSender.shouldFail = true;

    const now = new Date();
    // Tạo notification đã thất bại 4 lần (attempt 5 là lần cuối)
    const notification = await prisma.notification.create({
      data: {
        recipientId: testUserId,
        eventType: NotificationEventType.APPLICATION_STATUS_CHANGED,
        title: 'Trạng thái ứng tuyển thay đổi',
        body: 'Thông báo lần thử thứ 5',
        emailStatus: NotificationEmailStatus.FAILED,
        emailAttempts: 4,
        emailNextRetryAt: new Date(now.getTime() - 1000),
      },
    });

    await dispatchUseCase.execute(notification.id, now);

    const exhausted = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(exhausted.emailAttempts).toBe(MAX_EMAIL_ATTEMPTS);
    expect(exhausted.emailStatus).toBe(NotificationEmailStatus.FAILED);
    expect(exhausted.emailNextRetryAt).toBeNull(); // Không còn lịch thử lại
  });

  it('5. Chống chạy đè: Hai lượt scheduler chạy đồng thời thì lượt thứ hai trả SKIPPED_OVERLAPPING', async () => {
    // Chạy 2 lần đồng thời
    const [res1, res2] = await Promise.all([
      schedulerService.runRetryCheck('concurrent-1'),
      schedulerService.runRetryCheck('concurrent-2'),
    ]);

    const completed = res1.status === 'COMPLETED' ? res1 : res2;
    const skipped = res1.status === 'COMPLETED' ? res2 : res1;

    expect(completed.status).toBe('COMPLETED');
    expect(skipped.status).toBe('SKIPPED_OVERLAPPING');
  });
});
