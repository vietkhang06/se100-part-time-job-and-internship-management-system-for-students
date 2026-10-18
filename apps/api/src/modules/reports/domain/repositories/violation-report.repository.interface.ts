import {
  ViolationReason,
  ViolationReportStatus,
  ViolationTargetType,
} from '@campusjob/contracts';
import { ViolationReportEntity } from '../entities/violation-report.entity';

export const VIOLATION_REPORT_REPOSITORY_TOKEN = Symbol('VIOLATION_REPORT_REPOSITORY_TOKEN');

export interface CreateReportData {
  reporterId: string;
  targetType: ViolationTargetType;
  targetId: string;
  targetLabel: string | null;
  reason: ViolationReason;
  description: string;
  openKey: string;
  evidence: { url: string; note: string | null }[];
}

export interface IViolationReportRepository {
  /** duplicate=true khi người này đã có báo cáo còn mở về cùng đối tượng. */
  create(data: CreateReportData): Promise<{ report: ViolationReportEntity | null; duplicate: boolean }>;
  findById(id: string): Promise<ViolationReportEntity | null>;
  listByReporter(
    reporterId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ViolationReportEntity[]; total: number }>;
  /** Danh sách theo trạng thái cho Quản trị viên (UC59), cũ nhất trước. */
  listByStatus(
    status: ViolationReportStatus,
    page: number,
    limit: number,
  ): Promise<{ items: ViolationReportEntity[]; total: number }>;
  markUnderReview(id: string): Promise<void>;
  /**
   * Phán quyết cuối (UC59): chỉ chuyển được từ SUBSTANTIATED sang RESOLVED. Trả false nếu báo cáo không
   * còn ở SUBSTANTIATED (đã xử lý rồi hoặc chưa có căn cứ).
   */
  markResolved(id: string, at: Date): Promise<boolean>;
  /** Idempotent: đặt trạng thái kết luận, đóng openKey. */
  applyModerationOutcome(
    id: string,
    status: ViolationReportStatus.SUBSTANTIATED | ViolationReportStatus.DISMISSED,
    at: Date,
  ): Promise<boolean>;
}
