import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ModerationTargetType,
  NotificationEventType,
  UserRole,
  ViolationReason,
  ViolationReportStatus,
  ViolationTargetType as T,
} from '@campusjob/contracts';
import { CreateViolationReportUseCase } from './create-violation-report.use-case';
import { ReportTargetResolverRegistry } from '../ports/report-target-resolver.port';
import { ViolationReportEntity } from '../../domain/entities/violation-report.entity';
import { CreateViolationReportDto } from '../dto/violation-report.dto';
import { IViolationReportRepository } from '../../domain/repositories/violation-report.repository.interface';
import { IModerationQueue } from '../../../moderation/application/ports/moderation-queue.port';
import { INotificationPublisher } from '../../../notifications/application/ports/notification-publisher.port';

const entity = () =>
  new ViolationReportEntity({
    id: 'r1',
    reporterId: 'stu1',
    targetType: T.COMPANY,
    targetId: 'c1',
    targetLabel: 'ACME',
    reason: ViolationReason.FRAUD,
    description: 'Doanh nghiệp yêu cầu đóng phí trước khi nhận việc',
    status: ViolationReportStatus.SUBMITTED,
    evidence: [],
    moderatedAt: null,
    resolvedAt: null,
    createdAt: new Date(),
  });

const input = (over: Partial<CreateViolationReportDto> = {}): CreateViolationReportDto =>
  ({
    targetType: T.COMPANY,
    targetId: '3f9e1c5e-1b6f-4b52-9d52-1d7a0e1f0c11',
    reason: ViolationReason.FRAUD,
    description: 'Doanh nghiệp yêu cầu đóng phí trước khi nhận việc',
    ...over,
  }) as CreateViolationReportDto;

describe('CreateViolationReportUseCase', () => {
  const student = { id: 'stu1', role: UserRole.STUDENT };
  let repo: jest.Mocked<IViolationReportRepository>;
  let resolvers: ReportTargetResolverRegistry;
  let queue: jest.Mocked<IModerationQueue>;
  let notifications: jest.Mocked<INotificationPublisher>;
  let useCase: CreateViolationReportUseCase;

  beforeEach(() => {
    repo = {
      create: jest.fn(), findById: jest.fn(), listByReporter: jest.fn(), listByStatus: jest.fn(),
      markUnderReview: jest.fn(), markResolved: jest.fn(), applyModerationOutcome: jest.fn(),
    };
    resolvers = new ReportTargetResolverRegistry();
    resolvers.register(T.COMPANY, {
      resolve: jest.fn().mockResolvedValue({ ownerUserId: 'emp1', label: 'ACME' }),
    });
    queue = { enqueue: jest.fn().mockResolvedValue({ itemId: 'i1', round: 1, outcome: 'CREATED' }) };
    notifications = { publish: jest.fn().mockResolvedValue({ outcome: 'CREATED' }), publishMany: jest.fn() };
    useCase = new CreateViolationReportUseCase(repo, resolvers, queue, notifications);
  });

  it('creates the report, acknowledges it and forwards it to moderation', async () => {
    repo.create.mockResolvedValue({ report: entity(), duplicate: false });

    const dto = await useCase.execute(student, input());

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterId: 'stu1',
        targetType: T.COMPANY,
        openKey: expect.stringContaining('stu1:COMPANY:'),
      }),
    );
    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NotificationEventType.REPORT_RECEIVED,
        recipientId: 'stu1',
        payload: { reportId: 'r1' },
      }),
    );
    expect(queue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: ModerationTargetType.REPORT, targetId: 'r1' }),
    );
    expect(repo.markUnderReview).toHaveBeenCalledWith('r1');
    expect(dto.status).toBe(ViolationReportStatus.UNDER_REVIEW);
  });

  it('flags reports without evidence in the moderation summary', async () => {
    repo.create.mockResolvedValue({ report: entity(), duplicate: false });
    await useCase.execute(student, input());
    expect(queue.enqueue.mock.calls[0][0].summary).toContain('chưa có bằng chứng');
  });

  it('also queues a REVIEW moderation item when the reported target is a review (UC53)', async () => {
    resolvers.register(T.REVIEW, {
      resolve: jest.fn().mockResolvedValue({ ownerUserId: 'stu9', label: 'Đánh giá 1 sao' }),
    });
    repo.create.mockResolvedValue({ report: entity(), duplicate: false });

    await useCase.execute(student, input({ targetType: T.REVIEW }));

    const types = queue.enqueue.mock.calls.map(([entry]) => entry.targetType);
    expect(types).toEqual([ModerationTargetType.REPORT, ModerationTargetType.REVIEW]);
  });

  it('does not queue a REVIEW item for other target types', async () => {
    repo.create.mockResolvedValue({ report: entity(), duplicate: false });
    await useCase.execute(student, input());
    const types = queue.enqueue.mock.calls.map(([entry]) => entry.targetType);
    expect(types).toEqual([ModerationTargetType.REPORT]);
  });

  it('keeps the report as SUBMITTED when forwarding to moderation fails', async () => {
    repo.create.mockResolvedValue({ report: entity(), duplicate: false });
    queue.enqueue.mockRejectedValue(new Error('db down'));

    const dto = await useCase.execute(student, input());
    expect(dto.status).toBe(ViolationReportStatus.SUBMITTED);
    expect(repo.markUnderReview).not.toHaveBeenCalled();
  });

  it('rejects target types the role may not report', async () => {
    await expect(useCase.execute(student, input({ targetType: T.STUDENT }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('fails closed when no resolver is registered for the target type', async () => {
    await expect(useCase.execute(student, input({ targetType: T.JOB }))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the target does not exist', async () => {
    resolvers.register(T.COMPANY, { resolve: jest.fn().mockResolvedValue(null) });
    await expect(useCase.execute(student, input())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks reporting yourself', async () => {
    resolvers.register(T.COMPANY, {
      resolve: jest.fn().mockResolvedValue({ ownerUserId: 'stu1', label: 'x' }),
    });
    await expect(useCase.execute(student, input())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 409 for a duplicate open report and does not forward it', async () => {
    repo.create.mockResolvedValue({ report: null, duplicate: true });
    await expect(useCase.execute(student, input())).rejects.toBeInstanceOf(ConflictException);
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(notifications.publish).not.toHaveBeenCalled();
  });
});
