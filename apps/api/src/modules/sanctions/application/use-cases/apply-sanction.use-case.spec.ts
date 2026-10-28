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
  UserRole,
  ViolationReason,
  ViolationReportStatus as RS,
  ViolationTargetType as V,
} from '@campusjob/contracts';
import { ApplySanctionUseCase } from './apply-sanction.use-case';
import { CompanySanctionHandlerRegistry } from '../ports/company-sanction-handler.port';
import { SanctionEntity } from '../../domain/entities/sanction.entity';
import { ViolationReportEntity } from '../../../reports/domain/entities/violation-report.entity';
import { WARNING_ESCALATION_THRESHOLD } from '../../domain/policies/sanction-rules.policy';

const report = (over: Partial<ConstructorParameters<typeof ViolationReportEntity>[0]> = {}) =>
  new ViolationReportEntity({
    id: 'r1', reporterId: 'rep1', targetType: V.STUDENT, targetId: 'stu1', targetLabel: 'SV A',
    reason: ViolationReason.FRAUD, description: 'x'.repeat(30), status: RS.SUBSTANTIATED, evidence: [],
    moderatedAt: new Date(), resolvedAt: null, createdAt: new Date(), ...over,
  });

const saved = (type: S, endsAt: Date | null) =>
  new SanctionEntity({
    id: 'will-be-replaced', reportId: 'r1', targetType: SanctionTargetType.STUDENT, targetId: 'stu1', type,
    storedStatus: SanctionStatus.ACTIVE, reason: 'Vi phạm', startsAt: new Date(), endsAt, imposedBy: 'adm1',
    liftedAt: null, liftReason: null, createdAt: new Date(),
  });

describe('ApplySanctionUseCase', () => {
  const admin = { id: 'adm1' };
  const now = new Date('2026-10-15T00:00:00.000Z');
  let repo: any;
  let reports: { findById: jest.Mock; markResolved: jest.Mock };
  let users: { findById: jest.Mock };
  let notifications: { publish: jest.Mock };
  let handlers: CompanySanctionHandlerRegistry;
  let useCase: ApplySanctionUseCase;

  beforeEach(() => {
    repo = {
      findActiveByTarget: jest.fn().mockResolvedValue(null),
      countRecentWarnings: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async (d: any) => ({ sanction: saved(d.type, d.endsAt), duplicate: false })),
      findById: jest.fn().mockResolvedValue({ sanction: saved(S.WARNING, null), events: [] }),
    };
    reports = { findById: jest.fn().mockResolvedValue(report()), markResolved: jest.fn().mockResolvedValue(true) };
    users = { findById: jest.fn().mockResolvedValue({ id: 'stu1', role: UserRole.STUDENT }) };
    notifications = { publish: jest.fn().mockResolvedValue({ outcome: 'CREATED' }) };
    handlers = new CompanySanctionHandlerRegistry();
    useCase = new ApplySanctionUseCase(repo, reports as any, users as any, notifications as any, handlers);
  });

  const input = (over: any = {}) => ({ reportId: 'r1', type: S.WARNING, reason: '  Gian lận  ', ...over });

  it('applies a warning, closes the report and notifies both sides', async () => {
    await useCase.execute(admin, input(), now);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: 'r1', targetType: SanctionTargetType.STUDENT, targetId: 'stu1', type: S.WARNING,
        reason: 'Gian lận', endsAt: null, imposedBy: 'adm1',
      }),
    );
    expect(reports.markResolved).toHaveBeenCalledWith('r1', now);
    const events = notifications.publish.mock.calls.map((c: any[]) => c[0].eventType);
    expect(events).toEqual([NotificationEventType.SANCTION_APPLIED, NotificationEventType.REPORT_RESOLVED]);
    expect(notifications.publish.mock.calls[0][0].recipientId).toBe('stu1');
    expect(notifications.publish.mock.calls[1][0].recipientId).toBe('rep1');
  });

  it('links each notification to the right objects (report and sanction ids)', async () => {
    await useCase.execute(admin, input(), now);

    const toTarget = notifications.publish.mock.calls[0][0];
    const toReporter = notifications.publish.mock.calls[1][0];
    expect(toTarget.payload).toEqual(
      expect.objectContaining({ reportId: 'r1', sanctionId: expect.any(String), sanctionTypeCode: S.WARNING }),
    );
    expect(toReporter.payload).toEqual(
      expect.objectContaining({ reportId: 'r1', sanctionId: toTarget.payload.sanctionId, outcome: 'SANCTIONED' }),
    );
  });

  it('applies a time-limited application lock', async () => {
    await useCase.execute(admin, input({ type: S.APPLICATION_LOCK, durationDays: 7 }), now);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: S.APPLICATION_LOCK, endsAt: new Date('2026-10-22T00:00:00.000Z') }),
    );
  });

  it('refuses to sanction without a substantiated report (no grounds, no sanction)', async () => {
    for (const status of [RS.SUBMITTED, RS.UNDER_REVIEW, RS.DISMISSED]) {
      reports.findById.mockResolvedValue(report({ status }));
      await expect(useCase.execute(admin, input(), now)).rejects.toBeInstanceOf(ConflictException);
    }
    expect(repo.create).not.toHaveBeenCalled();
    expect(reports.markResolved).not.toHaveBeenCalled();
  });

  it('refuses an already resolved report and an unknown report', async () => {
    reports.findById.mockResolvedValue(report({ status: RS.RESOLVED }));
    await expect(useCase.execute(admin, input(), now)).rejects.toBeInstanceOf(ConflictException);
    reports.findById.mockResolvedValue(null);
    await expect(useCase.execute(admin, input(), now)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires a reason', async () => {
    await expect(useCase.execute(admin, input({ reason: '   ' }), now)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects sanction types that do not fit the report target', async () => {
    await expect(useCase.execute(admin, input({ type: S.COMPANY_SUSPENSION }), now)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    reports.findById.mockResolvedValue(report({ targetType: V.JOB }));
    await expect(useCase.execute(admin, input(), now)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing or out-of-range lock durations', async () => {
    await expect(useCase.execute(admin, input({ type: S.APPLICATION_LOCK }), now)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      useCase.execute(admin, input({ type: S.APPLICATION_LOCK, durationDays: 365 }), now),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 when the sanctioned student no longer exists or is not a student', async () => {
    users.findById.mockResolvedValue(null);
    await expect(useCase.execute(admin, input(), now)).rejects.toBeInstanceOf(NotFoundException);
    users.findById.mockResolvedValue({ id: 'stu1', role: UserRole.EMPLOYER });
    await expect(useCase.execute(admin, input(), now)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks stacking a second active lock on the same student', async () => {
    repo.findActiveByTarget.mockResolvedValue(saved(S.APPLICATION_LOCK, new Date('2026-12-01T00:00:00Z')));
    await expect(
      useCase.execute(admin, input({ type: S.APPLICATION_LOCK, durationDays: 7 }), now),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('forces escalation to a lock once the warning threshold is reached', async () => {
    repo.countRecentWarnings.mockResolvedValue(WARNING_ESCALATION_THRESHOLD);
    await expect(useCase.execute(admin, input(), now)).rejects.toBeInstanceOf(ConflictException);
    await expect(
      useCase.execute(admin, input({ type: S.APPLICATION_LOCK, durationDays: 14 }), now),
    ).resolves.toBeDefined();
  });

  it('returns 409 when another admin already sanctioned the same report', async () => {
    repo.create.mockResolvedValue({ sanction: null, duplicate: true });
    await expect(useCase.execute(admin, input(), now)).rejects.toBeInstanceOf(ConflictException);
    expect(reports.markResolved).not.toHaveBeenCalled();
  });

  it('does not fail the sanction when notifications fail', async () => {
    notifications.publish.mockRejectedValue(new Error('smtp'));
    await expect(useCase.execute(admin, input(), now)).resolves.toBeDefined();
  });

  describe('company suspension', () => {
    const companyReport = () => report({ targetType: V.COMPANY, targetId: 'comp1' });
    let handler: { describe: jest.Mock; suspend: jest.Mock; unsuspend: jest.Mock };

    beforeEach(() => {
      reports.findById.mockResolvedValue(companyReport());
      handler = {
        describe: jest.fn().mockResolvedValue({ ownerUserId: 'emp1', name: 'ACME' }),
        suspend: jest.fn().mockResolvedValue(undefined),
        unsuspend: jest.fn(),
      };
    });

    it('fails closed (503) when M03 has not registered a handler', async () => {
      await expect(useCase.execute(admin, input({ type: S.COMPANY_SUSPENSION }), now)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('suspends via the handler, then records the sanction and notifies the owner', async () => {
      handlers.register(handler);
      await useCase.execute(admin, input({ type: S.COMPANY_SUSPENSION }), now);

      expect(handler.suspend).toHaveBeenCalledWith('comp1', expect.any(String), 'Gian lận');
      const sanctionId = handler.suspend.mock.calls[0][1];
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: sanctionId, targetType: SanctionTargetType.COMPANY, type: S.COMPANY_SUSPENSION }),
      );
      expect(notifications.publish.mock.calls[0][0].recipientId).toBe('emp1');
    });

    it('records nothing when the suspension cannot be applied', async () => {
      handlers.register(handler);
      handler.suspend.mockRejectedValue(new Error('M03 down'));
      await expect(useCase.execute(admin, input({ type: S.COMPANY_SUSPENSION }), now)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
      expect(repo.create).not.toHaveBeenCalled();
      expect(reports.markResolved).not.toHaveBeenCalled();
    });

    it('returns 404 when the company does not exist', async () => {
      handler.describe.mockResolvedValue(null);
      handlers.register(handler);
      await expect(useCase.execute(admin, input({ type: S.COMPANY_SUSPENSION }), now)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
