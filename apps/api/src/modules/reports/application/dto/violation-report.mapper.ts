import { ViolationReportDetailDto, ViolationReportDto } from '@campusjob/contracts';
import { ViolationReportEntity } from '../../domain/entities/violation-report.entity';

export function toReportDto(r: ViolationReportEntity): ViolationReportDto {
  return {
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    targetLabel: r.targetLabel,
    reason: r.reason,
    description: r.description,
    status: r.status,
    evidenceCount: r.evidence.length,
    evidence: r.evidence.map((e) => ({ id: e.id, kind: e.kind, url: e.url, note: e.note })),
    createdAt: r.createdAt.toISOString(),
    moderatedAt: r.moderatedAt ? r.moderatedAt.toISOString() : null,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  };
}

export function toReportDetailDto(r: ViolationReportEntity): ViolationReportDetailDto {
  return { ...toReportDto(r), reporterId: r.reporterId };
}
