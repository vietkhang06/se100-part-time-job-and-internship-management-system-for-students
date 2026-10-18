import { Injectable } from '@nestjs/common';
import { ViolationReportStatus } from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { ViolationReportEntity } from '../../domain/entities/violation-report.entity';
import {
  CreateReportData,
  IViolationReportRepository,
} from '../../domain/repositories/violation-report.repository.interface';

@Injectable()
export class PrismaViolationReportRepository implements IViolationReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): ViolationReportEntity {
    return new ViolationReportEntity({
      id: raw.id,
      reporterId: raw.reporterId,
      targetType: raw.targetType,
      targetId: raw.targetId,
      targetLabel: raw.targetLabel ?? null,
      reason: raw.reason,
      description: raw.description,
      status: raw.status,
      evidence: (raw.evidence ?? []).map((e: any) => ({
        id: e.id,
        kind: e.kind,
        url: e.url ?? null,
        note: e.note ?? null,
      })),
      moderatedAt: raw.moderatedAt ?? null,
      resolvedAt: raw.resolvedAt ?? null,
      createdAt: raw.createdAt,
    });
  }

  async create(
    data: CreateReportData,
  ): Promise<{ report: ViolationReportEntity | null; duplicate: boolean }> {
    const existing = await this.prisma.violationReport.findUnique({ where: { openKey: data.openKey } });
    if (existing) {
      return { report: null, duplicate: true };
    }

    try {
      const raw = await this.prisma.violationReport.create({
        data: {
          reporterId: data.reporterId,
          targetType: data.targetType,
          targetId: data.targetId,
          targetLabel: data.targetLabel,
          reason: data.reason,
          description: data.description,
          openKey: data.openKey,
          evidence: {
            create: data.evidence.map((e) => ({ kind: 'URL' as const, url: e.url, note: e.note })),
          },
        },
        include: { evidence: true },
      });
      return { report: this.toDomain(raw), duplicate: false };
    } catch (err: any) {
      // Hai request song song cùng openKey: bên thua được coi là trùng.
      if (err?.code === 'P2002') {
        return { report: null, duplicate: true };
      }
      throw err;
    }
  }

  async findById(id: string): Promise<ViolationReportEntity | null> {
    const raw = await this.prisma.violationReport.findUnique({
      where: { id },
      include: { evidence: { orderBy: { createdAt: 'asc' } } },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async listByReporter(
    reporterId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ViolationReportEntity[]; total: number }> {
    const where = { reporterId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.violationReport.findMany({
        where,
        include: { evidence: { orderBy: { createdAt: 'asc' } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.violationReport.count({ where }),
    ]);
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async markUnderReview(id: string): Promise<void> {
    await this.prisma.violationReport.updateMany({
      where: { id, status: ViolationReportStatus.SUBMITTED },
      data: { status: ViolationReportStatus.UNDER_REVIEW },
    });
  }

  async applyModerationOutcome(
    id: string,
    status: ViolationReportStatus.SUBSTANTIATED | ViolationReportStatus.DISMISSED,
    at: Date,
  ): Promise<boolean> {
    const existing = await this.prisma.violationReport.findUnique({ where: { id } });
    if (!existing) return false;
    // Idempotent; và không bao giờ hạ báo cáo đã phán quyết cuối (RESOLVED) về trạng thái sơ bộ.
    if (existing.status === status || existing.status === ViolationReportStatus.RESOLVED) return true;

    await this.prisma.violationReport.update({
      where: { id },
      data: { status, moderatedAt: at, openKey: null },
    });
    return true;
  }

  async listByStatus(
    status: ViolationReportStatus,
    page: number,
    limit: number,
  ): Promise<{ items: ViolationReportEntity[]; total: number }> {
    const where = { status };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.violationReport.findMany({
        where,
        include: { evidence: { orderBy: { createdAt: 'asc' } } },
        orderBy: [{ moderatedAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.violationReport.count({ where }),
    ]);
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async markResolved(id: string, at: Date): Promise<boolean> {
    const result = await this.prisma.violationReport.updateMany({
      where: { id, status: ViolationReportStatus.SUBSTANTIATED },
      data: { status: ViolationReportStatus.RESOLVED, resolvedAt: at, openKey: null },
    });
    return result.count === 1;
  }
}
