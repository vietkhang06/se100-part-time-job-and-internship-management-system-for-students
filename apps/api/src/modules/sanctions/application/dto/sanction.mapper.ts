import { SanctionDetailDto, SanctionDto } from '@campusjob/contracts';
import { SanctionEntity, SanctionEventProps } from '../../domain/entities/sanction.entity';

export function toSanctionDto(s: SanctionEntity, now: Date = new Date()): SanctionDto {
  return {
    id: s.id,
    reportId: s.reportId,
    targetType: s.targetType,
    targetId: s.targetId,
    type: s.type,
    status: s.effectiveStatus(now),
    reason: s.reason,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt ? s.endsAt.toISOString() : null,
    imposedBy: s.imposedBy,
    liftedAt: s.liftedAt ? s.liftedAt.toISOString() : null,
    liftReason: s.liftReason,
    createdAt: s.createdAt.toISOString(),
  };
}

export function toSanctionDetailDto(
  s: SanctionEntity,
  events: SanctionEventProps[],
  now: Date = new Date(),
): SanctionDetailDto {
  return {
    ...toSanctionDto(s, now),
    events: events.map((e) => ({
      id: e.id,
      action: e.action,
      actorId: e.actorId,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
