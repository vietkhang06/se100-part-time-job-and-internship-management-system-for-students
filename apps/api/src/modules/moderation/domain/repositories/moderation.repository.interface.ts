import {
  ModerationDecisionType,
  ModerationStatus,
  ModerationTargetType,
} from '@campusjob/contracts';
import { ModerationDecisionEntity, ModerationItemEntity } from '../entities/moderation-item.entity';

export const MODERATION_REPOSITORY_TOKEN = Symbol('MODERATION_REPOSITORY_TOKEN');

export interface EnqueueData {
  targetType: ModerationTargetType;
  targetId: string;
  submitterId: string | null;
  summary: string | null;
}

export interface ListQueueFilter {
  status: ModerationStatus;
  targetType?: ModerationTargetType;
  assigneeId?: string;
  page: number;
  limit: number;
}

export interface DecideData {
  itemId: string;
  decision: ModerationDecisionType;
  newStatus: ModerationStatus;
  reason: string | null;
  proposedAction: string | null;
  reviewerId: string;
  now: Date;
}

export interface ModerationItemWithDecisions {
  item: ModerationItemEntity;
  decisions: ModerationDecisionEntity[];
}

export interface IModerationRepository {
  /** Nếu vòng gần nhất còn PENDING thì trả lại (created=false); ngược lại tạo vòng mới (round+1). */
  enqueue(data: EnqueueData): Promise<{ item: ModerationItemEntity; created: boolean }>;
  findById(id: string): Promise<ModerationItemWithDecisions | null>;
  list(filter: ListQueueFilter): Promise<{ items: ModerationItemEntity[]; total: number }>;

  /** Nhận xử lý. force=true (Admin) được chiếm item đã giao cho người khác. null nếu không chiếm được. */
  claim(id: string, actorId: string, now: Date, force: boolean): Promise<ModerationItemEntity | null>;

  /**
   * Ghi quyết định + chuyển trạng thái + audit log trong một transaction.
   * Chỉ thành công khi item còn PENDING (chống hai người quyết định cùng lúc); null nếu thua đua.
   */
  decide(data: DecideData): Promise<{ item: ModerationItemEntity; decision: ModerationDecisionEntity } | null>;

  markDecisionSynced(decisionId: string, at: Date): Promise<void>;
  markDecisionSyncFailed(decisionId: string, error: string): Promise<void>;
  findUnsyncedDecisions(limit: number): Promise<
    { decision: ModerationDecisionEntity; item: ModerationItemEntity }[]
  >;
}
