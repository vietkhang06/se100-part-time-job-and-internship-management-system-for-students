import {
  ViolationReason,
  ViolationReportStatus,
  ViolationTargetType,
} from '@campusjob/contracts';

export interface ViolationEvidenceProps {
  id: string;
  kind: 'URL' | 'FILE';
  url: string | null;
  note: string | null;
}

export interface ViolationReportProps {
  id: string;
  reporterId: string;
  targetType: ViolationTargetType;
  targetId: string;
  targetLabel: string | null;
  reason: ViolationReason;
  description: string;
  status: ViolationReportStatus;
  evidence: ViolationEvidenceProps[];
  moderatedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export class ViolationReportEntity {
  readonly id: string;
  readonly reporterId: string;
  readonly targetType: ViolationTargetType;
  readonly targetId: string;
  readonly targetLabel: string | null;
  readonly reason: ViolationReason;
  readonly description: string;
  readonly status: ViolationReportStatus;
  readonly evidence: ViolationEvidenceProps[];
  readonly moderatedAt: Date | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: ViolationReportProps) {
    this.id = props.id;
    this.reporterId = props.reporterId;
    this.targetType = props.targetType;
    this.targetId = props.targetId;
    this.targetLabel = props.targetLabel;
    this.reason = props.reason;
    this.description = props.description;
    this.status = props.status;
    this.evidence = props.evidence;
    this.moderatedAt = props.moderatedAt;
    this.resolvedAt = props.resolvedAt;
    this.createdAt = props.createdAt;
  }

  /** Báo cáo chưa có bằng chứng đính kèm: vẫn được tiếp nhận nhưng được gắn cờ cho người thẩm tra. */
  hasEvidence(): boolean {
    return this.evidence.length > 0;
  }
}
