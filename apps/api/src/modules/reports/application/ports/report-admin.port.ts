import { ViolationReportStatus, ViolationTargetType } from '@campusjob/contracts';
import { ViolationReportEntity } from '../../domain/entities/violation-report.entity';

export const REPORT_ADMIN_TOKEN = Symbol('REPORT_ADMIN_TOKEN');

/**
 * Cổng của M05-02 cho S2-M05-04 (chế tài): Quản trị viên xem báo cáo đã có kết luận và đóng báo cáo
 * sau phán quyết. Sanction module không đọc bảng báo cáo trực tiếp.
 */
export interface IReportAdmin {
  findById(id: string): Promise<ViolationReportEntity | null>;
  listByStatus(
    status: ViolationReportStatus,
    page: number,
    limit: number,
  ): Promise<{ items: ViolationReportEntity[]; total: number }>;
  /** SUBSTANTIATED → RESOLVED. false nếu báo cáo không còn ở SUBSTANTIATED. */
  markResolved(id: string, at: Date): Promise<boolean>;
  /**
   * Id các báo cáo về đối tượng đã được kết luận có căn cứ (SUBSTANTIATED hoặc đã RESOLVED) với thời điểm
   * kết luận `moderatedAt >= since` (tính cả đầu mút). Dùng để đếm "lần vi phạm" (ADR-015).
   */
  listViolationReportIds(targetType: ViolationTargetType, targetId: string, since: Date): Promise<string[]>;
}
