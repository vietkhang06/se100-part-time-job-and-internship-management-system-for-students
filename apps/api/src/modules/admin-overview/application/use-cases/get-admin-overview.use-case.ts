import { Injectable, Logger } from '@nestjs/common';
import { AdminOverviewDto, OverviewGroupDto, OverviewGroupStatus } from '@campusjob/contracts';
import { OVERVIEW_GROUPS, OverviewGroupDefinition } from '../../domain/overview-groups';
import { OverviewSourceRegistry } from '../ports/overview-source.port';

@Injectable()
export class GetAdminOverviewUseCase {
  private readonly logger = new Logger(GetAdminOverviewUseCase.name);

  constructor(private readonly registry: OverviewSourceRegistry) {}

  /**
   * UC54 — số liệu tổng quan cho Quản trị viên. Mỗi nhóm lấy từ nguồn thật của module sở hữu.
   * Nhóm chưa có nguồn hoặc truy vấn lỗi được đánh dấu UNAVAILABLE (kèm lý do), KHÔNG trả số 0 giả,
   * và một nhóm lỗi không làm hỏng các nhóm còn lại.
   */
  async execute(now: Date = new Date()): Promise<AdminOverviewDto> {
    const groups = await Promise.all(OVERVIEW_GROUPS.map((definition) => this.collectGroup(definition)));
    return { generatedAt: now.toISOString(), groups };
  }

  private async collectGroup(definition: OverviewGroupDefinition): Promise<OverviewGroupDto> {
    const source = this.registry.get(definition.key);
    if (!source) {
      return this.unavailable(definition, `Chưa có nguồn dữ liệu từ ${definition.owner}.`);
    }

    try {
      const result = await source.collect();
      return {
        key: definition.key,
        label: definition.label,
        status: OverviewGroupStatus.AVAILABLE,
        total: result.total,
        breakdownLabel: result.breakdownLabel,
        breakdown: result.breakdown.map((item) => ({ key: item.key, label: item.label, count: item.count })),
        unavailableReason: null,
      };
    } catch (err: any) {
      this.logger.error(`Overview source ${definition.key} failed: ${err?.message}`);
      return this.unavailable(definition, 'Không truy vấn được nguồn dữ liệu lúc này.');
    }
  }

  private unavailable(definition: OverviewGroupDefinition, reason: string): OverviewGroupDto {
    return {
      key: definition.key,
      label: definition.label,
      status: OverviewGroupStatus.UNAVAILABLE,
      total: null,
      breakdownLabel: null,
      breakdown: [],
      unavailableReason: reason,
    };
  }
}
