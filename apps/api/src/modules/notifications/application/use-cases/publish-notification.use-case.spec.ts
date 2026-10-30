import { BadRequestException } from '@nestjs/common';
import { NotificationEmailStatus, NotificationEventType } from '@campusjob/contracts';
import { PublishNotificationUseCase } from './publish-notification.use-case';
import { INotificationRepository } from '../../domain/repositories/notification.repository.interface';
import { NotificationEntity } from '../../domain/entities/notification.entity';
import { DispatchNotificationEmailUseCase } from './dispatch-notification-email.use-case';
import { IUserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { INotificationEmailSender } from '../ports/notification-email-sender.port';

const entity = (id = 'n1') =>
  new NotificationEntity({
    id,
    recipientId: 'u1',
    eventType: 'JOB_APPROVED',
    title: 't',
    body: 'b',
    payload: null,
    dedupeKey: null,
    readAt: null,
    emailStatus: NotificationEmailStatus.PENDING,
    emailAttempts: 0,
    emailLastError: null,
    emailSentAt: null,
    emailNextRetryAt: null,
    createdAt: new Date(),
  });

describe('PublishNotificationUseCase', () => {
  let repo: jest.Mocked<INotificationRepository>;
  let users: jest.Mocked<IUserRepository>;
  let dispatch: DispatchNotificationEmailUseCase;
  let dispatchExecute: jest.SpiedFunction<DispatchNotificationEmailUseCase['execute']>;
  let useCase: PublishNotificationUseCase;

  beforeEach(() => {
    repo = {
      create: jest.fn(), findById: jest.fn(), findByIdForRecipient: jest.fn(), list: jest.fn(),
      countUnread: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn(), claimForEmailDispatch: jest.fn(),
      markEmailSent: jest.fn(), markEmailFailed: jest.fn(), findEmailDispatchable: jest.fn(),
    };
    users = {
      findById: jest.fn().mockResolvedValue({ id: 'u1' }), findByEmail: jest.fn(), create: jest.fn(),
      createWithVerificationToken: jest.fn(), updateStatus: jest.fn(), updatePassword: jest.fn(),
      changePasswordAndRevokeSessions: jest.fn(),
    };
    const sender: INotificationEmailSender = { send: jest.fn() };
    dispatch = new DispatchNotificationEmailUseCase(repo, users, sender);
    dispatchExecute = jest.spyOn(dispatch, 'execute').mockResolvedValue('SENT');
    useCase = new PublishNotificationUseCase(repo, users, dispatch);
  });

  it('stores notification as PENDING email and dispatches for email-enabled events', async () => {
    repo.create.mockResolvedValue({ notification: entity(), created: true });

    const result = await useCase.publish({
      eventType: NotificationEventType.JOB_APPROVED,
      recipientId: 'u1',
      payload: { jobTitle: 'Intern' },
      dedupeKey: 'JOB_APPROVED:j1:d1',
    });

    expect(result).toEqual({ outcome: 'CREATED', notificationId: 'n1' });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'u1',
        emailStatus: NotificationEmailStatus.PENDING,
        dedupeKey: 'JOB_APPROVED:j1:d1',
      }),
    );
    expect(dispatchExecute).toHaveBeenCalledWith('n1');
  });

  it('uses NOT_REQUIRED and does not dispatch for in-app-only events', async () => {
    repo.create.mockResolvedValue({ notification: entity(), created: true });

    await useCase.publish({
      eventType: NotificationEventType.APPLICATION_SUBMITTED,
      recipientId: 'u1',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ emailStatus: NotificationEmailStatus.NOT_REQUIRED }),
    );
    expect(dispatchExecute).not.toHaveBeenCalled();
  });

  it('returns DUPLICATE and does not send email again', async () => {
    repo.create.mockResolvedValue({ notification: entity(), created: false });

    const result = await useCase.publish({
      eventType: NotificationEventType.JOB_APPROVED,
      recipientId: 'u1',
      dedupeKey: 'k',
    });

    expect(result.outcome).toBe('DUPLICATE');
    expect(dispatchExecute).not.toHaveBeenCalled();
  });

  it('still returns CREATED when dispatch crashes (event is already stored)', async () => {
    repo.create.mockResolvedValue({ notification: entity(), created: true });
    dispatchExecute.mockRejectedValue(new Error('db down'));

    const result = await useCase.publish({
      eventType: NotificationEventType.JOB_APPROVED,
      recipientId: 'u1',
    });
    expect(result.outcome).toBe('CREATED');
  });

  it('skips unknown recipient without throwing', async () => {
    users.findById.mockResolvedValue(null);
    const result = await useCase.publish({
      eventType: NotificationEventType.JOB_APPROVED,
      recipientId: 'ghost',
    });
    expect(result.outcome).toBe('RECIPIENT_NOT_FOUND');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects unknown event types', async () => {
    const input: Parameters<PublishNotificationUseCase['publish']>[0] = {
      eventType: NotificationEventType.JOB_APPROVED,
      recipientId: 'u1',
    };
    Object.assign(input, { eventType: 'NOPE' });
    await expect(useCase.publish(input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
