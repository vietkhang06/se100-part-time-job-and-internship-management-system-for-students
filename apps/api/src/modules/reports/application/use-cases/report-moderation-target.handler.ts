import { Inject, Injectable } from '@nestjs/common';
import { ModerationDecisionType, ViolationReportStatus } from '@campusjob/contracts';
import {
  IModerationTargetHandler,
  ModerationDecisionContext,
} from '../../../moderation/application/ports/moderation-target-handler.port';
import {
  IViolationReportRepository,
  VIOLATION_REPORT_REPOSITORY_TOKEN,
} from '../../domain/repositories/violation-report.repository.interface';

/**
 * Nhận kết luận sơ bộ (UC52) từ M05-01 và cập nhật trạng thái báo cáo.
 * Quy tắc cố ý: handler này CHỈ đổi trạng thái báo cáo. Không có đường nào từ đây tự áp chế tài —
 * chế tài là quyết định riêng của Quản trị viên (UC59, S2-M05-04).
 */
@Injectable()
export class ReportModerationTargetHandler implements IModerationTargetHandler {
  constructor(
    @Inject(VIOLATION_REPORT_REPOSITORY_TOKEN)
    private readonly repository: IViolationReportRepository,
  ) {}

  async applyDecision(context: ModerationDecisionContext): Promise<void> {
    const status =
      context.decision === ModerationDecisionType.SUBSTANTIATE
        ? ViolationReportStatus.SUBSTANTIATED
        : context.decision === ModerationDecisionType.DISMISS
          ? ViolationReportStatus.DISMISSED
          : null;

    if (!status) {
      throw new Error(`Unsupported decision for REPORT: ${context.decision}`);
    }

    const updated = await this.repository.applyModerationOutcome(context.targetId, status, new Date());
    if (!updated) {
      throw new Error(`Report ${context.targetId} not found`);
    }
  }
}
