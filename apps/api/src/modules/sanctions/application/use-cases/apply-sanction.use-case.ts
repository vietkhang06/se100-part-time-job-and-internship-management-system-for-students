import { randomUUID } from 'crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  NotificationEventType,
  SanctionDetailDto,
  SanctionTargetType,
  SanctionType,
  UserRole,
  ViolationReportStatus,
  ViolationTargetType,
} from '@campusjob/contracts';
import {
  ISanctionRepository,
  SANCTION_REPOSITORY_TOKEN,
} from '../../domain/repositories/sanction.repository.interface';
import {
  allowedSanctionTypes,
  computeEndsAt,
  describeSanction,
  escalationWindowStart,
  requiresEscalation,
  sanctionTargetType,
  validateDuration,
} from '../../domain/policies/sanction-rules.policy';
import { CompanySanctionHandlerRegistry } from '../ports/company-sanction-handler.port';
import { ApplySanctionDto } from '../dto/sanction.dto';
import { toSanctionDetailDto } from '../dto/sanction.mapper';
import {
  IReportAdmin,
  REPORT_ADMIN_TOKEN,
} from '../../../reports/application/ports/report-admin.port';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../../users/domain/repositories/user.repository.interface';
import {
  INotificationPublisher,
  NOTIFICATION_PUBLISHER_TOKEN,
} from '../../../notifications/application/ports/notification-publisher.port';

@Injectable()
export class ApplySanctionUseCase {
  private readonly logger = new Logger(ApplySanctionUseCase.name);

  constructor(
    @Inject(SANCTION_REPOSITORY_TOKEN) private readonly repository: ISanctionRepository,
    @Inject(REPORT_ADMIN_TOKEN) private readonly reports: IReportAdmin,
    @Inject(USER_REPOSITORY_TOKEN) private readonly users: IUserRepository,
    @Inject(NOTIFICATION_PUBLISHER_TOKEN) private readonly notifications: INotificationPublisher,
    private readonly companyHandlers: CompanySanctionHandlerRegistry,
  ) {}

  /** UC59 + UC60 (+ UC56 đình chỉ) — chỉ Quản trị viên, và chỉ khi báo cáo đã có căn cứ xác nhận. */
  async execute(admin: { id: string }, input: ApplySanctionDto, now: Date = new Date()): Promise<SanctionDetailDto> {
    const reason = input.reason?.trim();
    if (!reason) {
      throw new BadRequestException({ message: 'Cần nhập lý do chế tài.', code: 'SANCTION_REASON_REQUIRED' });
    }

    const report = await this.reports.findById(input.reportId);
    if (!report) {
      throw new NotFoundException({ message: 'Không tìm thấy báo cáo.', code: 'SANCTION_REPORT_NOT_FOUND' });
    }
    if (report.status === ViolationReportStatus.RESOLVED) {
      throw new ConflictException({
        message: 'Báo cáo này đã được phán quyết.',
        code: 'SANCTION_REPORT_ALREADY_RESOLVED',
      });
    }
    // Thiếu căn cứ thì không áp chế tài: bắt buộc kết luận "có căn cứ" từ bước thẩm tra (UC52).
    if (report.status !== ViolationReportStatus.SUBSTANTIATED) {
      throw new ConflictException({
        message: 'Chỉ áp chế tài khi báo cáo đã được xác nhận có căn cứ.',
        code: 'SANCTION_REPORT_NOT_SUBSTANTIATED',
      });
    }

    if (!allowedSanctionTypes(report.targetType).includes(input.type)) {
      throw new BadRequestException({
        message: 'Loại chế tài này không áp dụng cho đối tượng của báo cáo.',
        code: 'SANCTION_TYPE_NOT_ALLOWED',
      });
    }

    const durationError = validateDuration(input.type, input.durationDays);
    if (durationError) {
      throw new BadRequestException({ message: durationError, code: 'SANCTION_DURATION_INVALID' });
    }

    const targetType = sanctionTargetType(input.type);
    const target = await this.resolveTarget(report.targetType, report.targetId);

    if (input.type !== SanctionType.WARNING) {
      const active = await this.repository.findActiveByTarget(targetType, report.targetId, input.type, now);
      if (active) {
        throw new ConflictException({
          message: 'Đối tượng này đang chịu chế tài cùng loại.',
          code: 'SANCTION_ALREADY_ACTIVE',
        });
      }
    } else {
      const recent = await this.repository.countRecentWarnings(report.targetId, escalationWindowStart(now));
      if (requiresEscalation(recent)) {
        throw new ConflictException({
          message: 'Đã đủ ngưỡng cảnh cáo, cần áp dụng khóa quyền ứng tuyển.',
          code: 'SANCTION_ESCALATION_REQUIRED',
        });
      }
    }

    const sanctionId = randomUUID();
    const endsAt = computeEndsAt(input.type, input.durationDays, now);

    if (input.type === SanctionType.COMPANY_SUSPENSION) {
      try {
        await this.companyHandlers.get()!.suspend(report.targetId, sanctionId, reason);
      } catch (err: any) {
        this.logger.error(`Suspend company ${report.targetId} failed: ${err?.message}`);
        throw new BadGatewayException({
          message: 'Không thể đình chỉ doanh nghiệp lúc này. Vui lòng thử lại.',
          code: 'SANCTION_TARGET_SYNC_FAILED',
        });
      }
    }

    const { sanction, duplicate } = await this.repository.create({
      id: sanctionId,
      reportId: report.id,
      targetType,
      targetId: report.targetId,
      type: input.type,
      reason,
      startsAt: now,
      endsAt,
      imposedBy: admin.id,
    });
    if (duplicate || !sanction) {
      throw new ConflictException({
        message: 'Báo cáo này đã có chế tài.',
        code: 'SANCTION_ALREADY_APPLIED_FOR_REPORT',
      });
    }

    const closed = await this.reports.markResolved(report.id, now);
    if (!closed) {
      this.logger.warn(`Report ${report.id} was not in SUBSTANTIATED when closing after sanction ${sanction.id}`);
    }

    await this.notify(sanction.id, report.id, report.reporterId, target.recipientUserId, input.type, endsAt, reason);

    const found = await this.repository.findById(sanction.id);
    return toSanctionDetailDto(sanction, found?.events ?? [], now);
  }

  private async resolveTarget(
    reportTarget: ViolationTargetType,
    targetId: string,
  ): Promise<{ recipientUserId: string }> {
    if (reportTarget === ViolationTargetType.STUDENT) {
      const user = await this.users.findById(targetId);
      if (!user || user.role !== UserRole.STUDENT) {
        throw new NotFoundException({
          message: 'Không tìm thấy sinh viên bị báo cáo.',
          code: 'SANCTION_TARGET_NOT_FOUND',
        });
      }
      return { recipientUserId: user.id };
    }

    const handler = this.companyHandlers.get();
    if (!handler) {
      // Fail-closed: chưa kiểm tra/đình chỉ được doanh nghiệp thì không ghi chế tài "ảo".
      throw new ServiceUnavailableException({
        message: 'Chưa thể áp chế tài lên doanh nghiệp lúc này.',
        code: 'SANCTION_TARGET_UNAVAILABLE',
      });
    }
    const company = await handler.describe(targetId);
    if (!company) {
      throw new NotFoundException({
        message: 'Không tìm thấy doanh nghiệp bị báo cáo.',
        code: 'SANCTION_TARGET_NOT_FOUND',
      });
    }
    return { recipientUserId: company.ownerUserId };
  }

  private async notify(
    sanctionId: string,
    reportId: string,
    reporterId: string,
    recipientUserId: string,
    type: SanctionType,
    endsAt: Date | null,
    reason: string,
  ): Promise<void> {
    const results = await Promise.allSettled([
      this.notifications.publish({
        eventType: NotificationEventType.SANCTION_APPLIED,
        recipientId: recipientUserId,
        payload: { sanctionType: describeSanction(type, endsAt), reason },
        dedupeKey: `${NotificationEventType.SANCTION_APPLIED}:${sanctionId}`,
      }),
      this.notifications.publish({
        eventType: NotificationEventType.REPORT_RESOLVED,
        recipientId: reporterId,
        dedupeKey: `${NotificationEventType.REPORT_RESOLVED}:${reportId}`,
      }),
    ]);
    for (const r of results) {
      if (r.status === 'rejected') {
        this.logger.error(`Notification for sanction ${sanctionId} failed: ${r.reason?.message ?? r.reason}`);
      }
    }
  }
}
