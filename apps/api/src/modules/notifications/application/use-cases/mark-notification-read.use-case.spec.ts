import { NotFoundException } from '@nestjs/common';
import { NotificationEmailStatus } from '@campusjob/contracts';
import { MarkNotificationReadUseCase } from './mark-notification-read.use-case';
import { NotificationEntity } from '../../domain/entities/notification.entity';
import { INotificationRepository } from '../../domain/repositories/notification.repository.interface';

const make = (readAt: Date | null) =>
  new NotificationEntity({
    id: 'n1',
    recipientId: 'u1',
    eventType: 'JOB_APPROVED',
    title: 't',
    body: 'b',
    payload: null,
    dedupeKey: null,
    readAt,
    emailStatus: NotificationEmailStatus.NOT_REQUIRED,
    emailAttempts: 0,
    emailLastError: null,
    emailSentAt: null,
    emailNextRetryAt: null,
    createdAt: new Date(),
  });

describe('MarkNotificationReadUseCase', () => {
  let repo: jest.Mocked<INotificationRepository>;
  let useCase: MarkNotificationReadUseCase;

  beforeEach(() => {
    repo = {
      create: jest.fn(), findById: jest.fn(), findByIdForRecipient: jest.fn(), list: jest.fn(), countUnread: jest.fn(),
      markRead: jest.fn(), markAllRead: jest.fn(), claimForEmailDispatch: jest.fn(), markEmailSent: jest.fn(),
      markEmailFailed: jest.fn(), findEmailDispatchable: jest.fn(),
    };
    useCase = new MarkNotificationReadUseCase(repo);
  });

  it('marks an unread notification as read', async () => {
    repo.findByIdForRecipient.mockResolvedValue(make(null));
    repo.markRead.mockResolvedValue(make(new Date()));

    const dto = await useCase.execute('n1', 'u1');
    expect(dto.isRead).toBe(true);
    expect(repo.markRead).toHaveBeenCalledWith('n1', 'u1', expect.any(Date));
  });

  it('is idempotent for already-read notifications', async () => {
    repo.findByIdForRecipient.mockResolvedValue(make(new Date()));
    const dto = await useCase.execute('n1', 'u1');
    expect(dto.isRead).toBe(true);
    expect(repo.markRead).not.toHaveBeenCalled();
  });

  it('returns 404 for missing or foreign notifications', async () => {
    repo.findByIdForRecipient.mockResolvedValue(null);
    await expect(useCase.execute('n1', 'other')).rejects.toBeInstanceOf(NotFoundException);
  });
});
