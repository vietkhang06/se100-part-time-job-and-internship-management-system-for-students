import { BadRequestException } from '@nestjs/common';
import { NotificationEmailStatus, NotificationEventType } from '@campusjob/contracts';
import { PublishNotificationUseCase } from './publish-notification.use-case';
import { INotificationRepository } from '../../domain/repositories/notification.repository.interface';
import { NotificationEntity } from '../../domain/entities/notification.entity';

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
  let users: { findById: jest.Mock };
  let dispatch: { execute: jest.Mock };
  let useCase: PublishNotificationUseCase;

  beforeEach(() => {
    repo = { create: jest.fn() } as any;
    users = { findById: jest.fn().mockResolvedValue({ id: 'u1' }) };
    dispatch = { execute: jest.fn().mockResolvedValue('SENT') };
    useCase = new PublishNotificationUseCase(repo, users as any, dispatch as any);
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
    expect(dispatch.execute).toHaveBeenCalledWith('n1');
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
    expect(dispatch.execute).not.toHaveBeenCalled();
  });

  it('returns DUPLICATE and does not send email again', async () => {
    repo.create.mockResolvedValue({ notification: entity(), created: false });

    const result = await useCase.publish({
      eventType: NotificationEventType.JOB_APPROVED,
      recipientId: 'u1',
      dedupeKey: 'k',
    });

    expect(result.outcome).toBe('DUPLICATE');
    expect(dispatch.execute).not.toHaveBeenCalled();
  });

  it('still returns CREATED when dispatch crashes (event is already stored)', async () => {
    repo.create.mockResolvedValue({ notification: entity(), created: true });
    dispatch.execute.mockRejectedValue(new Error('db down'));

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
    await expect(
      useCase.publish({ eventType: 'NOPE' as any, recipientId: 'u1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
