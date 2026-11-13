import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  NotificationEventType,
  SanctionStatus,
  SanctionTargetType,
  SanctionType as S,
  UserRole,
  UserStatus,
  ViolationReason,
  ViolationReportStatus as RS,
  ViolationTargetType as V,
} from '@campusjob/contracts';
import { ApplySanctionUseCase } from './apply-sanction.use-case';
import { CompanySanctionHandlerRegistry } from '../ports/company-sanction-handler.port';
import { SanctionEntity } from '../../domain/entities/sanction.entity';
import { ViolationReportEntity } from '../../../reports/domain/entities/violation-report.entity';
import { violationWindowStart } from '../../domain/policies/sanction-rules.policy';
import { ISanctionRepository, CreateSanctionData } from '../../domain/repositories/sanction.repository.interface';
import { IReportAdmin } from '../../../reports/application/ports/report-admin.port';
import { IUserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { INotificationPublisher } from '../../../notifications/application/ports/notification-publisher.port';
import { ApplySanctionDto } from '../dto/sanction.dto';
import { UserEntity } from '../../../users/domain/entities/user.entity';

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
  let repo: jest.Mocked<ISanctionRepository>;
  let reports: jest.Mocked<IReportAdmin>;
  let users: jest.Mocked<IUserRepository>;
  let notifications: jest.Mocked<INotificationPublisher>;
  let handlers: CompanySanctionHandlerRegistry;
  let useCase: ApplySanctionUseCase;

  beforeEach(() => {
    repo = {
      list: jest.fn(), listByTarget: jest.fn(), lift: jest.fn(), recordAudit: jest.fn(),
      findActiveByTarget: jest.fn().mockResolvedValue(null),
      findLiftedReportIds: jest.fn().mockResolvedValue([]),
      recordExpired: jest.fn(),
      create: jest.fn().mockImplementation(async (d: CreateSanctionData) => ({ sanction: saved(d.type, d.endsAt), duplicate: false })),
      findById: jest.fn().mockResolvedValue({ sanction: saved(S.WARNING, null), events: [] }),
    };
    // Mặc định: sinh viên có 2 lần vi phạm (r1 đang phán quyết + 1 lần trước) → được cảnh cáo.
    reports = {
      findById: jest.fn().mockResolvedValue(report()),
      listByStatus: jest.fn(),
      markResolved: jest.fn().mockResolvedValue(true),
      listViolationReportIds: jest.fn().mockResolvedValue(['r1', 'prev1']),
    };
    users = {
      findById: jest.fn().mockResolvedValue({ id: 'stu1', role: UserRole.STUDENT }), findByEmail: jest.fn(),
      create: jest.fn(), createWithVerificationToken: jest.fn(), updateStatus: jest.fn(), updatePassword: jest.fn(),
      changePasswordAndRevokeSessions: jest.fn(),
    };
    notifications = { publish: jest.fn().mockResolvedValue({ outcome: 'CREATED' }), publishMany: jest.fn() };
    handlers = new CompanySanctionHandlerRegistry();
    useCase = new ApplySanctionUseCase(repo, reports, users, notifications, handlers);
  });

  const violations = (n: number) =>
    reports.listViolationReportIds.mockResolvedValue(['r1', ...Array.from({ length: n - 1 }, (_, i) => `prev${i + 1}`)]);

  const input = (over: Partial<ApplySanctionDto> = {}): ApplySanctionDto => ({ reportId: 'r1', type: S.WARNING, reason: '  Gian lận  ', ...over });

  it('applies a warning, closes the report and notifies both sides', async () => {
    await useCase.execute(admin, input(), now);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: 'r1', targetType: SanctionTargetType.STUDENT, targetId: 'stu1', type: S.WARNING,
        reason: 'Gian lận', endsAt: null, imposedBy: 'adm1',
      }),
    );
    expect(reports.markResolved).toHaveBeenCalledWith('r1', now);
    const events = notifications.publish.mock.calls.map(([notification]) => notification.eventType);
    expect(events).toEqual([NotificationEventType.SANCTION_APPLIED, NotificationEventType.REPORT_RESOLVED]);
    expect(notifications.publish.mock.calls[0][0].recipientId).toBe('stu1');
    expect(notifications.publish.mock.calls[1][0].recipientId).toBe('rep1');
  });

  it('links each notification to the right objects (report and sanction ids)', async () => {
    await useCase.execute(admin, input(), now);

    const toTarget = notifications.publish.mock.calls[0][0];
    const toReporter = notifications.publish.mock.calls[1][0];
    expect(toTarget.payload).toHaveProperty('sanctionId');
    expect(toTarget.payload).toEqual(
      expect.objectContaining({ reportId: 'r1', sanctionId: expect.any(String), sanctionTypeCode: S.WARNING }),
    );
    expect(toReporter.payload).toEqual(
      expect.objectContaining({ reportId: 'r1', sanctionId: toTarget.payload?.sanctionId, outcome: 'SANCTIONED' }),
    );
  });

  it('applies a time-limited application lock', async () => {
    violations(3);
    await useCase.execute(admin, input({ type: S.APPLICATION_LOCK, durationDays: 30 }), now);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: S.APPLICATION_LOCK, endsAt: new Date('2026-11-14T00:00:00.000Z') }),
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
    for (const durationDays of [29, 91, 365, 45.5]) {
      await expect(
        useCase.execute(admin, input({ type: S.APPLICATION_LOCK, durationDays }), now),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the sanctioned student no longer exists or is not a student', async () => {
    users.findById.mockResolvedValue(null);
    await expect(useCase.execute(admin, input(), now)).rejects.toBeInstanceOf(NotFoundException);
    users.findById.mockResolvedValue(new UserEntity(
      'stu1', 'employer@example.com', 'hash', 'Employer', UserRole.EMPLOYER, UserStatus.ACTIVE,
    ));
    await expect(useCase.execute(admin, input(), now)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks stacking a second active lock on the same student', async () => {
    violations(3);
    repo.findActiveByTarget.mockResolvedValue(saved(S.APPLICATION_LOCK, new Date('2026-12-01T00:00:00Z')));
    await expect(
      useCase.execute(admin, input({ type: S.APPLICATION_LOCK, durationDays: 30 }), now),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe('sanction tier by violation count (ADR-015)', () => {
    const code = async (over: Partial<ApplySanctionDto>): Promise<string> => {
      try {
        await useCase.execute(admin, input(over), now);
        return 'OK';
      } catch (e: unknown) {
        if (e instanceof HttpException) return (e.getResponse() as { code: string }).code;
        throw e;
      }
    };

    it('1st violation: neither warning nor lock may be applied, nothing is written (SP-01)', async () => {
      violations(1);
      expect(await code({})).toBe('SANCTION_TIER_INVALID');
      expect(await code({ type: S.APPLICATION_LOCK, durationDays: 30 })).toBe('SANCTION_TIER_INVALID');
      expect(repo.create).not.toHaveBeenCalled();
      expect(reports.markResolved).not.toHaveBeenCalled();
    });

    it('2nd violation: warning only (SP-03, SP-04)', async () => {
      violations(2);
      expect(await code({})).toBe('OK');
      expect(await code({ type: S.APPLICATION_LOCK, durationDays: 30 })).toBe('SANCTION_TIER_INVALID');
    });

    it('3rd violation and later: lock only, warning forces escalation (SP-05, SP-06)', async () => {
      for (const n of [3, 4]) {
        violations(n);
        expect(await code({})).toBe('SANCTION_ESCALATION_REQUIRED');
        expect(await code({ type: S.APPLICATION_LOCK, durationDays: 90 })).toBe('OK');
      }
    });

    it('counts the report being judged even if the report list does not return it', async () => {
      reports.listViolationReportIds.mockResolvedValue(['prev1']);
      expect(await code({})).toBe('OK'); // prev1 + r1 = 2 lần
    });

    it('counts the window from exactly 180 days before now (SP-09, SP-10)', async () => {
      await useCase.execute(admin, input(), now);
      expect(reports.listViolationReportIds).toHaveBeenCalledWith(
        V.STUDENT,
        'stu1',
        violationWindowStart(now),
      );
      expect(violationWindowStart(now)).toEqual(new Date('2026-04-18T00:00:00.000Z'));
    });

    it('does not count violations whose sanction was lifted (SP-14)', async () => {
      violations(3);
      repo.findLiftedReportIds.mockResolvedValue(['prev1']); // còn r1 + prev2 = 2 lần
      expect(await code({})).toBe('OK');
      expect(await code({ type: S.APPLICATION_LOCK, durationDays: 30 })).toBe('SANCTION_TIER_INVALID');
    });

    it('does not count violations of other students (query is scoped to the target)', async () => {
      await useCase.execute(admin, input(), now);
      expect(reports.listViolationReportIds.mock.calls[0][1]).toBe('stu1');
    });
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

    it('has no violation-count threshold for company suspension (SP-21 phần Admin)', async () => {
      handlers.register(handler);
      await useCase.execute(admin, input({ type: S.COMPANY_SUSPENSION }), now);
      expect(reports.listViolationReportIds).not.toHaveBeenCalled();
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
