import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ModerationStatus } from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  ModerationDecisionEntity,
  ModerationItemEntity,
} from '../../domain/entities/moderation-item.entity';
import {
  DecideData,
  EnqueueData,
  IModerationRepository,
  ListQueueFilter,
  ModerationItemWithDecisions,
} from '../../domain/repositories/moderation.repository.interface';

@Injectable()
export class PrismaModerationRepository implements IModerationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toItem(raw: any): ModerationItemEntity {
    return new ModerationItemEntity({
      id: raw.id,
      targetType: raw.targetType,
      targetId: raw.targetId,
      round: raw.round,
      status: raw.status,
      summary: raw.summary ?? null,
      submitterId: raw.submitterId ?? null,
      assigneeId: raw.assigneeId ?? null,
      assignedAt: raw.assignedAt ?? null,
      enqueuedAt: raw.enqueuedAt,
      decidedAt: raw.decidedAt ?? null,
    });
  }

  private toDecision(raw: any): ModerationDecisionEntity {
    return new ModerationDecisionEntity({
      id: raw.id,
      itemId: raw.itemId,
      decision: raw.decision,
      reason: raw.reason ?? null,
      proposedAction: raw.proposedAction ?? null,
      reviewerId: raw.reviewerId,
      targetSyncedAt: raw.targetSyncedAt ?? null,
      targetSyncError: raw.targetSyncError ?? null,
      createdAt: raw.createdAt,
    });
  }

  async enqueue(data: EnqueueData): Promise<{ item: ModerationItemEntity; created: boolean }> {
    const findLatest = () =>
      this.prisma.moderationItem.findFirst({
        where: { targetType: data.targetType, targetId: data.targetId },
        orderBy: { round: 'desc' },
      });

    const latest = await findLatest();
    if (latest && latest.status === ModerationStatus.PENDING) {
      return { item: this.toItem(latest), created: false };
    }

    try {
      const raw = await this.prisma.moderationItem.create({
        data: {
          targetType: data.targetType,
          targetId: data.targetId,
          round: (latest?.round ?? 0) + 1,
          summary: data.summary,
          submitterId: data.submitterId,
        },
      });
      return { item: this.toItem(raw), created: true };
    } catch (err: any) {
      // Hai lần enqueue song song cùng vòng: bên thua lấy lại bản ghi của bên thắng.
      if (err?.code === 'P2002') {
        const again = await findLatest();
        if (again) {
          return { item: this.toItem(again), created: false };
        }
      }
      throw err;
    }
  }

  async findById(id: string): Promise<ModerationItemWithDecisions | null> {
    const raw = await this.prisma.moderationItem.findUnique({
      where: { id },
      include: { decisions: { orderBy: { createdAt: 'asc' } } },
    });
    if (!raw) return null;
    return { item: this.toItem(raw), decisions: raw.decisions.map((d) => this.toDecision(d)) };
  }

  async list(filter: ListQueueFilter): Promise<{ items: ModerationItemEntity[]; total: number }> {
    const where: Prisma.ModerationItemWhereInput = {
      status: filter.status,
      ...(filter.targetType ? { targetType: filter.targetType } : {}),
      ...(filter.assigneeId ? { assigneeId: filter.assigneeId } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.moderationItem.findMany({
        where,
        orderBy: [{ enqueuedAt: 'asc' }, { id: 'asc' }],
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.moderationItem.count({ where }),
    ]);
    return { items: rows.map((r) => this.toItem(r)), total };
  }

  async claim(
    id: string,
    actorId: string,
    now: Date,
    force: boolean,
  ): Promise<ModerationItemEntity | null> {
    const result = await this.prisma.moderationItem.updateMany({
      where: {
        id,
        status: ModerationStatus.PENDING,
        ...(force ? {} : { OR: [{ assigneeId: null }, { assigneeId: actorId }] }),
      },
      data: { assigneeId: actorId, assignedAt: now },
    });
    if (result.count !== 1) return null;
    const raw = await this.prisma.moderationItem.findUnique({ where: { id } });
    return raw ? this.toItem(raw) : null;
  }

  async decide(
    data: DecideData,
  ): Promise<{ item: ModerationItemEntity; decision: ModerationDecisionEntity } | null> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.moderationItem.updateMany({
        where: { id: data.itemId, status: ModerationStatus.PENDING },
        data: {
          status: data.newStatus,
          decidedAt: data.now,
          // Người quyết định trở thành người phụ trách nếu mục chưa được giao.
          assigneeId: data.reviewerId,
        },
      });
      if (updated.count !== 1) {
        return null;
      }

      const decision = await tx.moderationDecision.create({
        data: {
          itemId: data.itemId,
          decision: data.decision,
          reason: data.reason,
          proposedAction: data.proposedAction,
          reviewerId: data.reviewerId,
        },
      });

      const item = await tx.moderationItem.findUniqueOrThrow({ where: { id: data.itemId } });

      await tx.auditLog.create({
        data: {
          actorId: data.reviewerId,
          action: `MODERATION_${data.decision}`,
          entityType: 'ModerationItem',
          entityId: data.itemId,
          metadata: {
            targetType: item.targetType,
            targetId: item.targetId,
            round: item.round,
            newStatus: data.newStatus,
            decisionId: decision.id,
          },
        },
      });

      return { item: this.toItem(item), decision: this.toDecision(decision) };
    });
  }

  async markDecisionSynced(decisionId: string, at: Date): Promise<void> {
    await this.prisma.moderationDecision.update({
      where: { id: decisionId },
      data: { targetSyncedAt: at, targetSyncError: null },
    });
  }

  async markDecisionSyncFailed(decisionId: string, error: string): Promise<void> {
    await this.prisma.moderationDecision.update({
      where: { id: decisionId },
      data: { targetSyncError: error },
    });
  }

  async findUnsyncedDecisions(
    limit: number,
  ): Promise<{ decision: ModerationDecisionEntity; item: ModerationItemEntity }[]> {
    const rows = await this.prisma.moderationDecision.findMany({
      where: { targetSyncedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: { item: true },
    });
    return rows.map((r) => ({ decision: this.toDecision(r), item: this.toItem(r.item) }));
  }
}
