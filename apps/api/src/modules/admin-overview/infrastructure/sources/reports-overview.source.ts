import { Injectable } from '@nestjs/common';
import { OverviewGroupKey, ViolationReportStatus } from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  IOverviewSource,
  OverviewSourceResult,
} from '../../application/ports/overview-source.port';

const STATUS_LABEL: Record<string, string> = {
  [ViolationReportStatus.SUBMITTED]: 'Đã gửi',
  [ViolationReportStatus.UNDER_REVIEW]: 'Đang thẩm tra',
  [ViolationReportStatus.SUBSTANTIATED]: 'Có căn cứ, chờ phán quyết',
  [ViolationReportStatus.DISMISSED]: 'Đã bác bỏ',
  [ViolationReportStatus.RESOLVED]: 'Đã xử lý',
};

/** Số báo cáo vi phạm theo trạng thái (M05, dữ liệu của chính module). */
@Injectable()
export class ReportsOverviewSource implements IOverviewSource {
  readonly key = OverviewGroupKey.REPORTS;

  constructor(private readonly prisma: PrismaService) {}

  async collect(): Promise<OverviewSourceResult> {
    const rows = await this.prisma.violationReport.groupBy({ by: ['status'], _count: { _all: true } });
    const counts = new Map<string, number>(rows.map((r) => [String(r.status), r._count._all]));

    const breakdown = Object.values(ViolationReportStatus).map((status) => ({
      key: status,
      label: STATUS_LABEL[status] ?? status,
      count: counts.get(status) ?? 0,
    }));
    return {
      total: breakdown.reduce((sum, item) => sum + item.count, 0),
      breakdownLabel: 'Theo trạng thái',
      breakdown,
    };
  }
}
