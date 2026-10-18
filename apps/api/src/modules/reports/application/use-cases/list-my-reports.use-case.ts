import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResponse, ViolationReportDto } from '@campusjob/contracts';
import {
  IViolationReportRepository,
  VIOLATION_REPORT_REPOSITORY_TOKEN,
} from '../../domain/repositories/violation-report.repository.interface';
import { toReportDto } from '../dto/violation-report.mapper';

@Injectable()
export class ListMyReportsUseCase {
  constructor(
    @Inject(VIOLATION_REPORT_REPOSITORY_TOKEN)
    private readonly repository: IViolationReportRepository,
  ) {}

  /** UC48 — danh sách và trạng thái báo cáo do chính người dùng đã gửi. */
  async execute(
    reporterId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<ViolationReportDto>> {
    const { items, total } = await this.repository.listByReporter(reporterId, page, limit);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      data: items.map(toReportDto),
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}
