import { SanctionStatus, SanctionTargetType, SanctionType } from '@campusjob/contracts';
import { SanctionEntity, SanctionEventProps } from '../entities/sanction.entity';

export const SANCTION_REPOSITORY_TOKEN = Symbol('SANCTION_REPOSITORY_TOKEN');

export interface CreateSanctionData {
  id: string;
  reportId: string;
  targetType: SanctionTargetType;
  targetId: string;
  type: SanctionType;
  reason: string;
  startsAt: Date;
  endsAt: Date | null;
  imposedBy: string;
}

export interface ListSanctionsFilter {
  status?: SanctionStatus;
  type?: SanctionType;
  targetId?: string;
  page: number;
  limit: number;
  now: Date;
}

export interface SanctionWithEvents {
  sanction: SanctionEntity;
  events: SanctionEventProps[];
}

export interface ISanctionRepository {
  /** Một transaction: chế tài + sự kiện APPLIED + audit log. duplicate=true khi báo cáo đã có chế tài. */
  create(data: CreateSanctionData): Promise<{ sanction: SanctionEntity | null; duplicate: boolean }>;
  findById(id: string): Promise<SanctionWithEvents | null>;
  list(filter: ListSanctionsFilter): Promise<{ items: SanctionEntity[]; total: number }>;
  listByTarget(
    targetType: SanctionTargetType,
    targetId: string,
    page: number,
    limit: number,
  ): Promise<{ items: SanctionEntity[]; total: number }>;
  /** Số cảnh cáo chưa bị gỡ của đối tượng, tạo từ `since` trở đi. */
  countRecentWarnings(targetId: string, since: Date): Promise<number>;
  findActiveByTarget(
    targetType: SanctionTargetType,
    targetId: string,
    type: SanctionType,
    now: Date,
  ): Promise<SanctionEntity | null>;
  /** Chỉ gỡ được chế tài đang ACTIVE. Một transaction: cập nhật + sự kiện LIFTED + audit. null nếu không còn ACTIVE. */
  lift(id: string, actorId: string, reason: string, now: Date): Promise<SanctionEntity | null>;
  recordAudit(data: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}
