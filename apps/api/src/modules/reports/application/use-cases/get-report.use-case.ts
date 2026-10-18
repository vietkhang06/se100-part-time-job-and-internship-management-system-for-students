import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ViolationReportDetailDto, ViolationReportDto } from '@campusjob/contracts';
import {
  IViolationReportRepository,
  VIOLATION_REPORT_REPOSITORY_TOKEN,
} from '../../domain/repositories/violation-report.repository.interface';
import { toReportDetailDto, toReportDto } from '../dto/violation-report.mapper';

const NOT_FOUND = {
  message: 'Không tìm thấy báo cáo.',
  code: 'REPORT_NOT_FOUND',
};

@Injectable()
export class GetReportUseCase {
  constructor(
    @Inject(VIOLATION_REPORT_REPOSITORY_TOKEN)
    private readonly repository: IViolationReportRepository,
  ) {}

  /** Người gửi chỉ xem được báo cáo của mình; báo cáo người khác trả 404. */
  async forReporter(id: string, reporterId: string): Promise<ViolationReportDto> {
    const report = await this.repository.findById(id);
    if (!report || report.reporterId !== reporterId) {
      throw new NotFoundException(NOT_FOUND);
    }
    return toReportDto(report);
  }

  /** UC52 — người thẩm tra xem đầy đủ báo cáo và bằng chứng. */
  async forReview(id: string): Promise<ViolationReportDetailDto> {
    const report = await this.repository.findById(id);
    if (!report) {
      throw new NotFoundException(NOT_FOUND);
    }
    return toReportDetailDto(report);
  }
}
