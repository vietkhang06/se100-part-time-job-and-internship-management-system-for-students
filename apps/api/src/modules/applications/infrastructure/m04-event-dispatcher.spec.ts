import { NotificationEventType } from '@campusjob/contracts';
import { PrismaM04EventDispatcher } from './m04-event-dispatcher';

describe('PrismaM04EventDispatcher', () => {
  const prisma = {
    m04EventOutbox: {
      findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn(),
    },
  };
  const notifications = { publish: jest.fn(), publishMany: jest.fn() };
  const jobs = {
    assertAcceptingApplications: jest.fn(), assertManagedBy: jest.fn(), getApplicationContext: jest.fn(),
    suggestClosingWhenFilled: jest.fn(),
  };
  const dispatcher = new PrismaM04EventDispatcher(prisma as never, notifications, jobs);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.m04EventOutbox.updateMany.mockResolvedValue({ count: 1 });
    prisma.m04EventOutbox.update.mockResolvedValue({});
  });

  it('publishes notification events with the outbox dedupe key', async () => {
    prisma.m04EventOutbox.findMany.mockResolvedValue([{
      id: 'event-1', eventType: NotificationEventType.INTERVIEW_INVITED,
      recipientId: 'student-1', payload: { interviewId: 'interview-1' },
      dedupeKey: 'dedupe-1', attemptCount: 0,
    }]);
    notifications.publish.mockResolvedValue({ outcome: 'CREATED' });

    await dispatcher.dispatchPending();

    expect(notifications.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventType: NotificationEventType.INTERVIEW_INVITED,
      recipientId: 'student-1', dedupeKey: 'dedupe-1',
    }));
    expect(prisma.m04EventOutbox.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'event-1' }, data: expect.objectContaining({ publishedAt: expect.any(Date) }),
    }));
  });

  it('routes close suggestions to M03 and does not create an M05 notification', async () => {
    prisma.m04EventOutbox.findMany.mockResolvedValue([{
      id: 'event-2', eventType: 'JOB_CLOSE_SUGGESTED', recipientId: 'company-1',
      payload: { jobId: 'job-1', applicationId: 'app-1', acceptedCount: 3 },
      dedupeKey: 'dedupe-2', attemptCount: 0,
    }]);
    jobs.suggestClosingWhenFilled.mockResolvedValue(true);

    await dispatcher.dispatchPending();

    expect(jobs.suggestClosingWhenFilled).toHaveBeenCalledWith({
      jobId: 'job-1', applicationId: 'app-1', acceptedCount: 3,
    });
    expect(notifications.publish).not.toHaveBeenCalled();
  });

  it('keeps a failed publish pending with retry metadata', async () => {
    prisma.m04EventOutbox.findMany.mockResolvedValue([{
      id: 'event-3', eventType: NotificationEventType.APPLICATION_STATUS_CHANGED,
      recipientId: 'student-1', payload: {}, dedupeKey: 'dedupe-3', attemptCount: 1,
    }]);
    notifications.publish.mockRejectedValue(new Error('temporary M05 failure'));

    await dispatcher.dispatchPending();

    expect(prisma.m04EventOutbox.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'event-3' },
      data: expect.objectContaining({ lastError: 'temporary M05 failure', availableAt: expect.any(Date) }),
    }));
  });
});
