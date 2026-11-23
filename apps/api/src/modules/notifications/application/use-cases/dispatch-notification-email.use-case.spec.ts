import { NotificationEmailStatus } from '@campusjob/contracts';
import { DispatchNotificationEmailUseCase } from './dispatch-notification-email.use-case';
import { INotificationRepository } from '../../domain/repositories/notification.repository.interface';
import { INotificationPreferenceRepository } from '../../domain/repositories/notification-preference.repository.interface';
import { IUserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { INotificationEmailSender } from '../ports/notification-email-sender.port';
import { NotificationEntity } from '../../domain/entities/notification.entity';
import { MAX_EMAIL_ATTEMPTS } from '../../domain/policies/email-retry.policy';
import { UserEntity } from '../../../users/domain/entities/user.entity';
import { UserRole, UserStatus } from '@campusjob/contracts';

const makeNotification = (over: Partial<ConstructorParameters<typeof NotificationEntity>[0]> = {}) =>
  new NotificationEntity({
    id: 'n1',
    recipientId: 'u1',
    eventType: 'JOB_APPROVED',
    title: 'Tin đã duyệt',
    body: 'Nội dung <b>',
    payload: null,
    dedupeKey: null,
    readAt: null,
    emailStatus: NotificationEmailStatus.PENDING,
    emailAttempts: 0,
    emailLastError: null,
    emailSentAt: null,
    emailNextRetryAt: null,
    createdAt: new Date(),
    ...over,
  });

describe('DispatchNotificationEmailUseCase', () => {
  let repo: jest.Mocked<INotificationRepository>;
  let prefRepo: jest.Mocked<INotificationPreferenceRepository>;
  let users: jest.Mocked<IUserRepository>;
  let sender: jest.Mocked<INotificationEmailSender>;
  let useCase: DispatchNotificationEmailUseCase;
  const now = new Date('2026-10-13T00:00:00.000Z');

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdForRecipient: jest.fn(),
      list: jest.fn(),
      countUnread: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
      claimForEmailDispatch: jest.fn().mockResolvedValue(true),
      markEmailSent: jest.fn(),
      markEmailNotRequired: jest.fn(),
      markEmailFailed: jest.fn(),
      findEmailDispatchable: jest.fn(),
    };
    prefRepo = {
      findByUser: jest.fn(),
      findByUserAndEvent: jest.fn(),
      upsert: jest.fn(),
      isEmailEnabled: jest.fn().mockResolvedValue(true),
    };
    users = {
      findById: jest.fn().mockResolvedValue(new UserEntity('u1', 'a@b.com', 'hash', 'User', UserRole.STUDENT, UserStatus.ACTIVE)),
      findByEmail: jest.fn(), create: jest.fn(), createWithVerificationToken: jest.fn(), updateStatus: jest.fn(),
      updatePassword: jest.fn(), changePasswordAndRevokeSessions: jest.fn(),
    };
    sender = { send: jest.fn().mockResolvedValue(undefined) };
    useCase = new DispatchNotificationEmailUseCase(repo, users, sender, prefRepo);
  });

  it('marks SENT and escapes html on success', async () => {
    repo.findById.mockResolvedValue(makeNotification());
    const result = await useCase.execute('n1', now);

    expect(result).toBe('SENT');
    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.com', html: '<p>Nội dung &lt;b&gt;</p>' }),
    );
    expect(repo.markEmailSent).toHaveBeenCalledWith('n1', expect.any(Date));
  });

  it('skips dispatch and marks NOT_REQUIRED when user disabled email preference', async () => {
    repo.findById.mockResolvedValue(makeNotification());
    prefRepo.isEmailEnabled.mockResolvedValue(false);

    const result = await useCase.execute('n1', now);

    expect(result).toBe('SKIPPED');
    expect(repo.markEmailNotRequired).toHaveBeenCalledWith('n1');
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('skips when notification does not need email', async () => {
    repo.findById.mockResolvedValue(makeNotification({ emailStatus: NotificationEmailStatus.SENT }));
    expect(await useCase.execute('n1', now)).toBe('SKIPPED');
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('skips when another worker holds the lease', async () => {
    repo.findById.mockResolvedValue(makeNotification());
    repo.claimForEmailDispatch.mockResolvedValue(false);
    expect(await useCase.execute('n1', now)).toBe('SKIPPED');
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('marks FAILED with next retry when SMTP fails (event is not lost)', async () => {
    repo.findById.mockResolvedValue(makeNotification());
    sender.send.mockRejectedValue(new Error('SMTP down'));

    expect(await useCase.execute('n1', now)).toBe('FAILED');
    expect(repo.markEmailFailed).toHaveBeenCalledWith('n1', {
      attempts: 1,
      error: 'SMTP down',
      nextRetryAt: new Date(now.getTime() + 60 * 1000),
    });
  });

  it('stops retrying after the last allowed attempt', async () => {
    repo.findById.mockResolvedValue(
      makeNotification({
        emailStatus: NotificationEmailStatus.FAILED,
        emailAttempts: MAX_EMAIL_ATTEMPTS - 1,
      }),
    );
    sender.send.mockRejectedValue(new Error('fatal'));

    expect(await useCase.execute('n1', now)).toBe('FAILED');
    expect(repo.markEmailFailed).toHaveBeenCalledWith('n1', {
      attempts: MAX_EMAIL_ATTEMPTS,
      error: 'fatal',
      nextRetryAt: null,
    });
  });
});
