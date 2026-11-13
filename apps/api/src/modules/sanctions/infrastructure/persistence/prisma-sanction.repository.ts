import { Injectable } from '@nestjs/common';
import { Prisma, type Sanction } from '@prisma/client';
import {
  SanctionStatus,
  SanctionTargetType,
  SanctionType,
} from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { SanctionEntity } from '../../domain/entities/sanction.entity';
import {
  CreateSanctionData,
  ISanctionRepository,
  ListSanctionsFilter,
  SanctionWithEvents,
} from '../../domain/repositories/sanction.repository.interface';

@Injectable()
export class PrismaSanctionRepository implements ISanctionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: Sanction): SanctionEntity {
    return new SanctionEntity({
      id: raw.id,
      reportId: raw.reportId,
      targetType: raw.targetType as SanctionEntity['targetType'],
      targetId: raw.targetId,
      type: raw.type as SanctionEntity['type'],
      storedStatus: raw.status as SanctionEntity['storedStatus'],
      reason: raw.reason,
      startsAt: raw.startsAt,
      endsAt: raw.endsAt ?? null,
      imposedBy: raw.imposedBy,
      liftedAt: raw.liftedAt ?? null,
      liftReason: raw.liftReason ?? null,
      createdAt: raw.createdAt,
    });
  }

  async create(data: CreateSanctionData): Promise<{ sanction: SanctionEntity | null; duplicate: boolean }> {
    try {
      const raw = await this.prisma.$transaction(async (tx) => {
        const sanction = await tx.sanction.create({
          data: {
            id: data.id,
            reportId: data.reportId,
            targetType: data.targetType,
            targetId: data.targetId,
            type: data.type,
            reason: data.reason,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
            imposedBy: data.imposedBy,
          },
        });
        await tx.sanctionEvent.create({
          data: { sanctionId: data.id, action: 'APPLIED', actorId: data.imposedBy, note: data.reason },
        });
        await tx.auditLog.create({
          data: {
            actorId: data.imposedBy,
            action: 'SANCTION_APPLIED',
            entityType: 'Sanction',
            entityId: data.id,
            metadata: {
              reportId: data.reportId,
              type: data.type,
              targetType: data.targetType,
              targetId: data.targetId,
              endsAt: data.endsAt ? data.endsAt.toISOString() : null,
            },
          },
        });
        return sanction;
      });
      return { sanction: this.toDomain(raw), duplicate: false };
    } catch (err: unknown) {
      // reportId UNIQUE: báo cáo này đã có chế tài (hai Admin cùng bấm).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { sanction: null, duplicate: true };
      }
      throw err;
    }
  }

  async findById(id: string): Promise<SanctionWithEvents | null> {
    const raw = await this.prisma.sanction.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!raw) return null;
    return {
      sanction: this.toDomain(raw),
      events: raw.events.map((e) => ({
        id: e.id,
        action: e.action as 'APPLIED' | 'LIFTED' | 'EXPIRED',
        actorId: e.actorId,
        note: e.note ?? null,
        createdAt: e.createdAt,
      })),
    };
  }

  async list(filter: ListSanctionsFilter): Promise<{ items: SanctionEntity[]; total: number }> {
    const where: Prisma.SanctionWhereInput = {
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.targetId ? { targetId: filter.targetId } : {}),
    };
    // EXPIRED không lưu: ACTIVE trong DB nhưng đã quá endsAt.
    if (filter.status === SanctionStatus.LIFTED) {
      where.status = 'LIFTED';
    } else if (filter.status === SanctionStatus.EXPIRED) {
      where.status = 'ACTIVE';
      where.endsAt = { lte: filter.now };
    } else if (filter.status === SanctionStatus.ACTIVE) {
      where.status = 'ACTIVE';
      where.OR = [{ endsAt: null }, { endsAt: { gt: filter.now } }];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sanction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.sanction.count({ where }),
    ]);
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async listByTarget(
    targetType: SanctionTargetType,
    targetId: string,
    page: number,
    limit: number,
  ): Promise<{ items: SanctionEntity[]; total: number }> {
    const where = { targetType, targetId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sanction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sanction.count({ where }),
    ]);
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async findLiftedReportIds(reportIds: string[]): Promise<string[]> {
    if (reportIds.length === 0) return [];
    const rows = await this.prisma.sanction.findMany({
      where: { reportId: { in: reportIds }, status: 'LIFTED' },
      select: { reportId: true },
    });
    return rows.map((r) => r.reportId);
  }

  async recordExpired(now: Date, targetId?: string): Promise<number> {
    const due = await this.prisma.sanction.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: { lte: now },
        events: { none: { action: 'EXPIRED' } },
        ...(targetId ? { targetId } : {}),
      },
      select: { id: true, type: true, targetType: true, targetId: true, endsAt: true },
      take: 200,
    });

    let recorded = 0;
    for (const s of due) {
      const done = await this.prisma.$transaction(async (tx) => {
        // Kiểm lại trong transaction để hai lần gọi song song không ghi trùng sự kiện.
        const exists = await tx.sanctionEvent.count({ where: { sanctionId: s.id, action: 'EXPIRED' } });
        if (exists > 0) return false;
        await tx.sanctionEvent.create({
          data: { sanctionId: s.id, action: 'EXPIRED', actorId: 'SYSTEM', note: 'Hết thời hạn chế tài' },
        });
        await tx.auditLog.create({
          data: {
            actorId: null,
            action: 'SANCTION_EXPIRED',
            entityType: 'Sanction',
            entityId: s.id,
            metadata: {
              type: s.type,
              targetType: s.targetType,
              targetId: s.targetId,
              endsAt: s.endsAt ? s.endsAt.toISOString() : null,
            },
          },
        });
        return true;
      });
      if (done) recorded += 1;
    }
    return recorded;
  }

  async findActiveByTarget(
    targetType: SanctionTargetType,
    targetId: string,
    type: SanctionType,
    now: Date,
  ): Promise<SanctionEntity | null> {
    const raw = await this.prisma.sanction.findFirst({
      where: {
        targetType,
        targetId,
        type,
        status: 'ACTIVE',
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async lift(id: string, actorId: string, reason: string, now: Date): Promise<SanctionEntity | null> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sanction.updateMany({
        where: { id, status: 'ACTIVE', OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        data: { status: 'LIFTED', liftedBy: actorId, liftedAt: now, liftReason: reason },
      });
      if (updated.count !== 1) return null;

      await tx.sanctionEvent.create({
        data: { sanctionId: id, action: 'LIFTED', actorId, note: reason },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SANCTION_LIFTED',
          entityType: 'Sanction',
          entityId: id,
          metadata: { reason },
        },
      });
      const raw = await tx.sanction.findUniqueOrThrow({ where: { id } });
      return this.toDomain(raw);
    });
  }

  async recordAudit(data: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  }
}
