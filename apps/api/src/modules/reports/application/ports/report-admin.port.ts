import { ViolationReportStatus } from '@campusjob/contracts';
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
}
