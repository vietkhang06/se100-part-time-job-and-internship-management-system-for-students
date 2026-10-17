import { ModerationDecisionDto, ModerationItemDetailDto, ModerationItemDto } from '@campusjob/contracts';
import { ModerationDecisionEntity, ModerationItemEntity } from '../../domain/entities/moderation-item.entity';

export function toItemDto(item: ModerationItemEntity): ModerationItemDto {
  return {
    id: item.id,
    targetType: item.targetType,
    targetId: item.targetId,
    round: item.round,
    status: item.status,
    summary: item.summary,
    submitterId: item.submitterId,
    assigneeId: item.assigneeId,
    assignedAt: item.assignedAt ? item.assignedAt.toISOString() : null,
    enqueuedAt: item.enqueuedAt.toISOString(),
    decidedAt: item.decidedAt ? item.decidedAt.toISOString() : null,
  };
}

export function toDecisionDto(d: ModerationDecisionEntity): ModerationDecisionDto {
  return {
    id: d.id,
    decision: d.decision,
    reason: d.reason,
    proposedAction: d.proposedAction,
    reviewerId: d.reviewerId,
    createdAt: d.createdAt.toISOString(),
    targetSynced: d.isTargetSynced(),
  };
}

export function toItemDetailDto(
  item: ModerationItemEntity,
  decisions: ModerationDecisionEntity[],
): ModerationItemDetailDto {
  return { ...toItemDto(item), decisions: decisions.map(toDecisionDto) };
}
