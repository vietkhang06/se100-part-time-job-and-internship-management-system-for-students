import { ModerationDecisionType, ModerationStatus, ModerationTargetType } from '@campusjob/contracts';

export interface ModerationItemProps {
  id: string;
  targetType: ModerationTargetType;
  targetId: string;
  round: number;
  status: ModerationStatus;
  summary: string | null;
  submitterId: string | null;
  assigneeId: string | null;
  assignedAt: Date | null;
  enqueuedAt: Date;
  decidedAt: Date | null;
}

export class ModerationItemEntity {
  readonly id: string;
  readonly targetType: ModerationTargetType;
  readonly targetId: string;
  readonly round: number;
  readonly status: ModerationStatus;
  readonly summary: string | null;
  readonly submitterId: string | null;
  readonly assigneeId: string | null;
  readonly assignedAt: Date | null;
  readonly enqueuedAt: Date;
  readonly decidedAt: Date | null;

  constructor(props: ModerationItemProps) {
    this.id = props.id;
    this.targetType = props.targetType;
    this.targetId = props.targetId;
    this.round = props.round;
    this.status = props.status;
    this.summary = props.summary;
    this.submitterId = props.submitterId;
    this.assigneeId = props.assigneeId;
    this.assignedAt = props.assignedAt;
    this.enqueuedAt = props.enqueuedAt;
    this.decidedAt = props.decidedAt;
  }

  isPending(): boolean {
    return this.status === ModerationStatus.PENDING;
  }
}

export interface ModerationDecisionProps {
  id: string;
  itemId: string;
  decision: ModerationDecisionType;
  reason: string | null;
  proposedAction: string | null;
  reviewerId: string;
  targetSyncedAt: Date | null;
  targetSyncError: string | null;
  createdAt: Date;
}

export class ModerationDecisionEntity {
  readonly id: string;
  readonly itemId: string;
  readonly decision: ModerationDecisionType;
  readonly reason: string | null;
  readonly proposedAction: string | null;
  readonly reviewerId: string;
  readonly targetSyncedAt: Date | null;
  readonly targetSyncError: string | null;
  readonly createdAt: Date;

  constructor(props: ModerationDecisionProps) {
    this.id = props.id;
    this.itemId = props.itemId;
    this.decision = props.decision;
    this.reason = props.reason;
    this.proposedAction = props.proposedAction;
    this.reviewerId = props.reviewerId;
    this.targetSyncedAt = props.targetSyncedAt;
    this.targetSyncError = props.targetSyncError;
    this.createdAt = props.createdAt;
  }

  isTargetSynced(): boolean {
    return this.targetSyncedAt !== null;
  }
}
