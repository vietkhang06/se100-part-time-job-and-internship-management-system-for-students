import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/database/prisma.service';
import { GlobalExceptionFilter } from '../src/shared/filters/http-exception.filter';
import {
  NotificationEmailStatus,
  NotificationEventType,
  UserRole,
  UserStatus,
} from '@campusjob/contracts';
import { PasswordHasher } from '../src/modules/auth/infrastructure/security/password-hasher';
import {
  INotificationPublisher,
  NOTIFICATION_PUBLISHER_TOKEN,
} from '../src/modules/notifications/application/ports/notification-publisher.port';
import {
  INotificationEmailSender,
  NOTIFICATION_EMAIL_SENDER_TOKEN,
} from '../src/modules/notifications/application/ports/notification-email-sender.port';

const request = supertest;

describe('S6-M05-03: Notification Email Preferences (E2E & Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let publisher: INotificationPublisher;

  const sentEmails: Array<{ to: string; subject: string; html: string }> = [];

  const testPassword = 'PreferencePassword123!@#';
  const userAEmail = 'np-user-a@campusjob.local';
  const userBEmail = 'np-user-b@campusjob.local';
  const testEmails = [userAEmail, userBEmail];

  let userAId: string;
  let userBId: string;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    sentEmails.length = 0;
    const fakeEmailSender: INotificationEmailSender = {
      send: async (input) => {
        sentEmails.push(input);
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NOTIFICATION_EMAIL_SENDER_TOKEN)
      .useValue(fakeEmailSender)
      .compile();

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
    publisher = app.get<INotificationPublisher>(NOTIFICATION_PUBLISHER_TOKEN);

    await cleanupDatabase();
    await seedTestUsers();

    tokenA = await loginUser(userAEmail);
    tokenB = await loginUser(userBEmail);
  });

  afterAll(async () => {
    await cleanupDatabase();
    if (app) {
      await app.close();
    }
  });

  async function cleanupDatabase() {
    const users = await prisma.user.findMany({
      where: { email: { in: testEmails } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);

    if (userIds.length > 0) {
      await (prisma as any).notificationEmailPreference?.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.notification.deleteMany({
        where: { recipientId: { in: userIds } },
      });
      await prisma.authSession.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  }

  async function seedTestUsers() {
    const hash = await PasswordHasher.hash(testPassword);

    const userA = await prisma.user.create({
      data: {
        email: userAEmail,
        passwordHash: hash,
        fullName: 'User A Preferences',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: userBEmail,
        passwordHash: hash,
        fullName: 'User B Preferences',
        role: UserRole.EMPLOYER,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    userBId = userB.id;
  }

  async function loginUser(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: testPassword })
      .expect(200);
    return res.body.accessToken || res.body.data?.accessToken;
  }

  it('NP-1: GET returns default emailEnabled=true for all email-capable notification types', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(11);

    for (const item of res.body) {
      expect(item).toHaveProperty('eventType');
      expect(item.emailEnabled).toBe(true);
    }

    const jobApprovedPref = res.body.find(
      (p: any) => p.eventType === NotificationEventType.JOB_APPROVED,
    );
    expect(jobApprovedPref).toBeDefined();
    expect(jobApprovedPref.emailEnabled).toBe(true);
  });

  it('NP-2: PATCH persists preference for a specific notification type', async () => {
    const patchRes = await request(app.getHttpServer())
      .patch('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        eventType: NotificationEventType.JOB_APPROVED,
        emailEnabled: false,
      })
      .expect(200);

    expect(patchRes.body).toEqual({
      eventType: NotificationEventType.JOB_APPROVED,
      emailEnabled: false,
    });

    // Verify persisted via subsequent GET
    const getRes = await request(app.getHttpServer())
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const updatedPref = getRes.body.find(
      (p: any) => p.eventType === NotificationEventType.JOB_APPROVED,
    );
    expect(updatedPref).toBeDefined();
    expect(updatedPref.emailEnabled).toBe(false);
  });

  it('NP-3: Independent toggles: updating JOB_APPROVED does not affect other types', async () => {
    const getRes = await request(app.getHttpServer())
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const interviewPref = getRes.body.find(
      (p: any) => p.eventType === NotificationEventType.INTERVIEW_INVITED,
    );
    const statusChangedPref = getRes.body.find(
      (p: any) => p.eventType === NotificationEventType.APPLICATION_STATUS_CHANGED,
    );

    expect(interviewPref.emailEnabled).toBe(true);
    expect(statusChangedPref.emailEnabled).toBe(true);
  });

  it('NP-4: Email suppression: suppresses email when disabled for event type', async () => {
    sentEmails.length = 0;

    const publishRes = await publisher.publish({
      eventType: NotificationEventType.JOB_APPROVED,
      recipientId: userAId,
      payload: { jobTitle: 'Backend Developer' },
      dedupeKey: `JOB_APPROVED:test-np-4:${userAId}`,
    });

    expect(publishRes.outcome).toBe('CREATED');
    expect(publishRes.notificationId).toBeDefined();

    // Check DB record: emailStatus must be NOT_REQUIRED
    const storedNotification = await prisma.notification.findUnique({
      where: { id: publishRes.notificationId },
    });
    expect(storedNotification).toBeDefined();
    expect(storedNotification?.emailStatus).toBe(NotificationEmailStatus.NOT_REQUIRED);

    // Verify no email was sent to user A
    expect(sentEmails.some((e) => e.to === userAEmail)).toBe(false);
  });

  it('NP-5: In-app notification is preserved and accessible when email is disabled', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const items = listRes.body.data || listRes.body.items || listRes.body;
    expect(Array.isArray(items)).toBe(true);
    const jobApprovedNotification = items.find(
      (n: any) => n.eventType === NotificationEventType.JOB_APPROVED,
    );
    expect(jobApprovedNotification).toBeDefined();

    const countRes = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(countRes.body.unreadCount).toBeGreaterThan(0);
  });

  it('NP-6: Cross-user isolation: User A disabling email does not affect User B', async () => {
    sentEmails.length = 0;

    // User B still has JOB_APPROVED enabled by default
    const publishResB = await publisher.publish({
      eventType: NotificationEventType.JOB_APPROVED,
      recipientId: userBId,
      payload: { jobTitle: 'Frontend Engineer' },
      dedupeKey: `JOB_APPROVED:test-np-6:${userBId}`,
    });

    expect(publishResB.outcome).toBe('CREATED');

    const storedNotificationB = await prisma.notification.findUnique({
      where: { id: publishResB.notificationId },
    });
    expect(storedNotificationB?.emailStatus).toBe(NotificationEmailStatus.SENT);

    // Verify email was sent to user B
    expect(sentEmails.some((e) => e.to === userBEmail)).toBe(true);

    // User B preferences remain independent
    const getResB = await request(app.getHttpServer())
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const jobApprovedPrefB = getResB.body.find(
      (p: any) => p.eventType === NotificationEventType.JOB_APPROVED,
    );
    expect(jobApprovedPrefB.emailEnabled).toBe(true);
  });

  it('NP-7: Validation and error handling', async () => {
    // 401 without auth token
    await request(app.getHttpServer())
      .get('/api/v1/notifications/preferences')
      .expect(401);

    await request(app.getHttpServer())
      .patch('/api/v1/notifications/preferences')
      .send({ eventType: NotificationEventType.JOB_APPROVED, emailEnabled: false })
      .expect(401);

    // 400 for invalid eventType
    await request(app.getHttpServer())
      .patch('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ eventType: 'INVALID_EVENT_TYPE', emailEnabled: false })
      .expect(400);

    // 400 for non-email-capable event type
    await request(app.getHttpServer())
      .patch('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ eventType: NotificationEventType.APPLICATION_SUBMITTED, emailEnabled: false })
      .expect(400);

    // 400 for missing/invalid emailEnabled
    await request(app.getHttpServer())
      .patch('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ eventType: NotificationEventType.JOB_APPROVED, emailEnabled: 'not-a-bool' })
      .expect(400);
  });
});
