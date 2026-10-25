import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationEventType, ViolationReportStatus } from '@campusjob/contracts';
import {
  ISanctionRepository,
  SANCTION_REPOSITORY_TOKEN,
} from '../../domain/repositories/sanction.repository.interface';
import {
  IReportAdmin,
  REPORT_ADMIN_TOKEN,
} from '../../../reports/application/ports/report-admin.port';
import {
  INotificationPublisher,
  NOTIFICATION_PUBLISHER_TOKEN,
} from '../../../notifications/application/ports/notification-publisher.port';

@Injectable()
export class CloseReportWithoutSanctionUseCase {
  private readonly logger = new Logger(CloseReportWithoutSanctionUseCase.name);

  constructor(
    @Inject(SANCTION_REPOSITORY_TOKEN) private readonly repository: ISanctionRepository,
    @Inject(REPORT_ADMIN_TOKEN) private readonly reports: IReportAdmin,
    @Inject(NOTIFICATION_PUBLISHER_TOKEN) private readonly notifications: INotificationPublisher,
  ) {}

  /** UC59 — Quản trị viên phán quyết cuối là KHÔNG xử phạt (kèm lý do) và đóng báo cáo. */
  async execute(admin: { id: string }, reportId: string, reason: string): Promise<{ reportId: string }> {
    const text = reason?.trim();
    if (!text) {
      throw new BadRequestException({ message: 'Cần nhập lý do.', code: 'SANCTION_REASON_REQUIRED' });
    }

    const report = await this.reports.findById(reportId);
    if (!report) {
      throw new NotFoundException({ message: 'Không tìm thấy báo cáo.', code: 'SANCTION_REPORT_NOT_FOUND' });
    }
    if (report.status === ViolationReportStatus.RESOLVED) {
      throw new ConflictException({
        message: 'Báo cáo này đã được phán quyết.',
        code: 'SANCTION_REPORT_ALREADY_RESOLVED',
      });
    }
    if (report.status !== ViolationReportStatus.SUBSTANTIATED) {
      throw new ConflictException({
        message: 'Chỉ phán quyết các báo cáo đã được xác nhận có căn cứ.',
        code: 'SANCTION_REPORT_NOT_SUBSTANTIATED',
      });
    }

    const closed = await this.reports.markResolved(reportId, new Date());
    if (!closed) {
      throw new ConflictException({
        message: 'Báo cáo này vừa được phán quyết bởi người khác.',
        code: 'SANCTION_REPORT_ALREADY_RESOLVED',
      });
    }

    await this.repository.recordAudit({
      actorId: admin.id,
      action: 'REPORT_CLOSED_WITHOUT_SANCTION',
      entityType: 'ViolationReport',
      entityId: reportId,
      metadata: { reason: text },
    });

    try {
      await this.notifications.publish({
        eventType: NotificationEventType.REPORT_RESOLVED,
        recipientId: report.reporterId,
        payload: { reportId, outcome: 'CLOSED_WITHOUT_SANCTION', reason: text },
        dedupeKey: `${NotificationEventType.REPORT_RESOLVED}:${reportId}`,
      });
    } catch (err: any) {
      this.logger.error(`Notify reporter for report ${reportId} failed: ${err?.message}`);
    }
    return { reportId };
  }
}
