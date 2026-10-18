import { Inject, Injectable } from '@nestjs/common';
import { ViolationReportStatus } from '@campusjob/contracts';
import {
  IViolationReportRepository,
  VIOLATION_REPORT_REPOSITORY_TOKEN,
} from '../../domain/repositories/violation-report.repository.interface';
import { ViolationReportEntity } from '../../domain/entities/violation-report.entity';
import { IReportAdmin } from '../ports/report-admin.port';

@Injectable()
export class ReportAdminService implements IReportAdmin {
  constructor(
    @Inject(VIOLATION_REPORT_REPOSITORY_TOKEN)
    private readonly repository: IViolationReportRepository,
  ) {}

  findById(id: string): Promise<ViolationReportEntity | null> {
    return this.repository.findById(id);
  }

  listByStatus(status: ViolationReportStatus, page: number, limit: number) {
    return this.repository.listByStatus(status, page, limit);
  }

  markResolved(id: string, at: Date): Promise<boolean> {
    return this.repository.markResolved(id, at);
  }
}
