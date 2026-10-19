import { SanctionStatus, SanctionTargetType, SanctionType } from '@campusjob/contracts';

export interface SanctionEventProps {
  id: string;
  action: 'APPLIED' | 'LIFTED';
  actorId: string;
  note: string | null;
  createdAt: Date;
}

export interface SanctionProps {
  id: string;
  reportId: string;
  targetType: SanctionTargetType;
  targetId: string;
  type: SanctionType;
  /** Trạng thái lưu trong DB: chỉ ACTIVE hoặc LIFTED. */
  storedStatus: SanctionStatus.ACTIVE | SanctionStatus.LIFTED;
  reason: string;
  startsAt: Date;
  endsAt: Date | null;
  imposedBy: string;
  liftedAt: Date | null;
  liftReason: string | null;
  createdAt: Date;
}

export class SanctionEntity {
  readonly id: string;
  readonly reportId: string;
  readonly targetType: SanctionTargetType;
  readonly targetId: string;
  readonly type: SanctionType;
  readonly storedStatus: SanctionStatus.ACTIVE | SanctionStatus.LIFTED;
  readonly reason: string;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly imposedBy: string;
  readonly liftedAt: Date | null;
  readonly liftReason: string | null;
  readonly createdAt: Date;

  constructor(props: SanctionProps) {
    this.id = props.id;
    this.reportId = props.reportId;
    this.targetType = props.targetType;
    this.targetId = props.targetId;
    this.type = props.type;
    this.storedStatus = props.storedStatus;
    this.reason = props.reason;
    this.startsAt = props.startsAt;
    this.endsAt = props.endsAt;
    this.imposedBy = props.imposedBy;
    this.liftedAt = props.liftedAt;
    this.liftReason = props.liftReason;
    this.createdAt = props.createdAt;
  }

  /** Hết hạn tự động: ACTIVE nhưng đã quá endsAt thì coi là EXPIRED, không cần job chạy nền. */
  effectiveStatus(now: Date): SanctionStatus {
    if (this.storedStatus === SanctionStatus.LIFTED) return SanctionStatus.LIFTED;
    if (this.endsAt && this.endsAt.getTime() <= now.getTime()) return SanctionStatus.EXPIRED;
    return SanctionStatus.ACTIVE;
  }

  isActiveAt(now: Date): boolean {
    return this.effectiveStatus(now) === SanctionStatus.ACTIVE;
  }
}
