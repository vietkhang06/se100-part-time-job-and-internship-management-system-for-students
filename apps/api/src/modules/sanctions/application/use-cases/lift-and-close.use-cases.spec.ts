import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  NotificationEventType,
  SanctionStatus,
  SanctionTargetType,
  SanctionType as S,
  ViolationReason,
  ViolationReportStatus as RS,
  ViolationTargetType as V,
} from '@campusjob/contracts';
import { LiftSanctionUseCase } from './lift-sanction.use-case';
import { CloseReportWithoutSanctionUseCase } from './close-report-without-sanction.use-case';
import { CompanySanctionHandlerRegistry } from '../ports/company-sanction-handler.port';
import { SanctionEntity } from '../../domain/entities/sanction.entity';
import { ViolationReportEntity } from '../../../reports/domain/entities/violation-report.entity';
import { ISanctionRepository } from '../../domain/repositories/sanction.repository.interface';
import { IReportAdmin } from '../../../reports/application/ports/report-admin.port';
import { INotificationPublisher } from '../../../notifications/application/ports/notification-publisher.port';

const sanction = (over: Partial<ConstructorParameters<typeof SanctionEntity>[0]> = {}) =>
  new SanctionEntity({
    id: 's1', reportId: 'r1', targetType: SanctionTargetType.STUDENT, targetId: 'stu1', type: S.APPLICATION_LOCK,
    storedStatus: SanctionStatus.ACTIVE, reason: 'x', startsAt: new Date('2026-10-01T00:00:00Z'),
    endsAt: new Date('2026-12-01T00:00:00Z'), imposedBy: 'adm1', liftedAt: null, liftReason: null,
    createdAt: new Date(), ...over,
  });

describe('LiftSanctionUseCase', () => {
  const admin = { id: 'adm1' };
  const now = new Date('2026-10-15T00:00:00.000Z');
  let repo: jest.Mocked<ISanctionRepository>;
  let handlers: CompanySanctionHandlerRegistry;
  let useCase: LiftSanctionUseCase;

  beforeEach(() => {
    repo = {
      create: jest.fn(), list: jest.fn(), listByTarget: jest.fn(), countRecentWarnings: jest.fn(),
      findActiveByTarget: jest.fn(), recordAudit: jest.fn(),
      findById: jest.fn().mockResolvedValue({ sanction: sanction(), events: [] }),
      lift: jest.fn().mockResolvedValue(sanction({ storedStatus: SanctionStatus.LIFTED, liftedAt: now })),
    };
    handlers = new CompanySanctionHandlerRegistry();
    useCase = new LiftSanctionUseCase(repo, handlers);
  });

  it('lifts an active sanction with a reason and returns the history', async () => {
    const dto = await useCase.execute(admin, 's1', '  Khiếu nại thành công ', now);
    expect(repo.lift).toHaveBeenCalledWith('s1', 'adm1', 'Khiếu nại thành công', now);
    expect(dto.status).toBe(SanctionStatus.LIFTED);
  });

  it('requires a reason and an existing sanction', async () => {
    await expect(useCase.execute(admin, 's1', ' ', now)).rejects.toBeInstanceOf(BadRequestException);
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute(admin, 's1', 'ok', now)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to lift a sanction that already expired or was lifted', async () => {
    repo.findById.mockResolvedValue({ sanction: sanction({ endsAt: new Date('2026-10-10T00:00:00Z') }), events: [] });
    await expect(useCase.execute(admin, 's1', 'ok', now)).rejects.toBeInstanceOf(ConflictException);
    repo.findById.mockResolvedValue({ sanction: sanction({ storedStatus: SanctionStatus.LIFTED }), events: [] });
    await expect(useCase.execute(admin, 's1', 'ok', now)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.lift).not.toHaveBeenCalled();
  });

  it('returns 409 when another admin lifted it first', async () => {
    repo.lift.mockResolvedValue(null);
    await expect(useCase.execute(admin, 's1', 'ok', now)).rejects.toBeInstanceOf(ConflictException);
  });

  describe('company suspension', () => {
    beforeEach(() => {
      repo.findById.mockResolvedValue({
        sanction: sanction({ type: S.COMPANY_SUSPENSION, targetType: SanctionTargetType.COMPANY, targetId: 'c1', endsAt: null }),
        events: [],
      });
    });

    it('fails closed without a handler, and calls unsuspend when present', async () => {
      await expect(useCase.execute(admin, 's1', 'ok', now)).rejects.toBeInstanceOf(ServiceUnavailableException);
      const handler = { describe: jest.fn(), suspend: jest.fn(), unsuspend: jest.fn().mockResolvedValue(undefined) };
      handlers.register(handler);
      await useCase.execute(admin, 's1', 'ok', now);
      expect(handler.unsuspend).toHaveBeenCalledWith('c1', 's1');
    });

    it('keeps the sanction active when the handler fails', async () => {
      handlers.register({
        describe: jest.fn(), suspend: jest.fn(), unsuspend: jest.fn().mockRejectedValue(new Error('down')),
      });
      await expect(useCase.execute(admin, 's1', 'ok', now)).rejects.toBeInstanceOf(BadGatewayException);
      expect(repo.lift).not.toHaveBeenCalled();
    });
  });
});

describe('CloseReportWithoutSanctionUseCase', () => {
  const admin = { id: 'adm1' };
  let repo: jest.Mocked<ISanctionRepository>;
  let reports: jest.Mocked<IReportAdmin>;
  let notifications: jest.Mocked<INotificationPublisher>;
  let useCase: CloseReportWithoutSanctionUseCase;

  const report = (status: RS) =>
    new ViolationReportEntity({
      id: 'r1', reporterId: 'rep1', targetType: V.STUDENT, targetId: 'stu1', targetLabel: null,
      reason: ViolationReason.SPAM, description: 'x'.repeat(30), status, evidence: [],
      moderatedAt: null, resolvedAt: null, createdAt: new Date(),
    });

  beforeEach(() => {
    repo = {
      create: jest.fn(), findById: jest.fn(), list: jest.fn(), listByTarget: jest.fn(), countRecentWarnings: jest.fn(),
      findActiveByTarget: jest.fn(), lift: jest.fn(), recordAudit: jest.fn().mockResolvedValue(undefined),
    };
    reports = {
      findById: jest.fn().mockResolvedValue(report(RS.SUBSTANTIATED)), listByStatus: jest.fn(),
      markResolved: jest.fn().mockResolvedValue(true),
    };
    notifications = { publish: jest.fn().mockResolvedValue({ outcome: 'CREATED' }), publishMany: jest.fn() };
    useCase = new CloseReportWithoutSanctionUseCase(repo, reports, notifications);
  });

  it('closes a substantiated report, audits it and tells the reporter', async () => {
    await useCase.execute(admin, 'r1', '  Đã nhắc nhở  ');
    expect(reports.markResolved).toHaveBeenCalledWith('r1', expect.any(Date));
    expect(repo.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REPORT_CLOSED_WITHOUT_SANCTION', entityId: 'r1' }),
    );
    expect(notifications.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: NotificationEventType.REPORT_RESOLVED,
        recipientId: 'rep1',
        payload: expect.objectContaining({ reportId: 'r1', outcome: 'CLOSED_WITHOUT_SANCTION' }),
      }),
    );
  });

  it('only closes reports that are substantiated and not yet resolved', async () => {
    for (const status of [RS.SUBMITTED, RS.UNDER_REVIEW, RS.DISMISSED, RS.RESOLVED]) {
      reports.findById.mockResolvedValue(report(status));
      await expect(useCase.execute(admin, 'r1', 'ok')).rejects.toBeInstanceOf(ConflictException);
    }
    expect(reports.markResolved).not.toHaveBeenCalled();
  });

  it('requires a reason, an existing report, and handles a lost race', async () => {
    await expect(useCase.execute(admin, 'r1', ' ')).rejects.toBeInstanceOf(BadRequestException);
    reports.findById.mockResolvedValue(null);
    await expect(useCase.execute(admin, 'r1', 'ok')).rejects.toBeInstanceOf(NotFoundException);
    reports.findById.mockResolvedValue(report(RS.SUBSTANTIATED));
    reports.markResolved.mockResolvedValue(false);
    await expect(useCase.execute(admin, 'r1', 'ok')).rejects.toBeInstanceOf(ConflictException);
  });
});
