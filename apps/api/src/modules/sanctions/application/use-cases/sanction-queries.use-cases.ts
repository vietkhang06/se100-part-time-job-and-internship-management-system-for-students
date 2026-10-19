import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PaginatedResponse,
  SanctionDetailDto,
  SanctionDto,
  SanctionTargetType,
  ViolationReportDetailDto,
  ViolationReportStatus,
} from '@campusjob/contracts';
import {
  ISanctionRepository,
  SANCTION_REPOSITORY_TOKEN,
} from '../../domain/repositories/sanction.repository.interface';
import { ListSanctionsQueryDto } from '../dto/sanction.dto';
import { toSanctionDetailDto, toSanctionDto } from '../dto/sanction.mapper';
import {
  IReportAdmin,
  REPORT_ADMIN_TOKEN,
} from '../../../reports/application/ports/report-admin.port';
import { toReportDetailDto } from '../../../reports/application/dto/violation-report.mapper';

function pageMeta(page: number, limit: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    totalItems: total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

@Injectable()
export class ListReportsForVerdictUseCase {
  constructor(@Inject(REPORT_ADMIN_TOKEN) private readonly reports: IReportAdmin) {}

  /** UC59 — các báo cáo đã có kết luận "có căn cứ", đang chờ Quản trị viên phán quyết. */
  async execute(page: number, limit: number): Promise<PaginatedResponse<ViolationReportDetailDto>> {
    const { items, total } = await this.reports.listByStatus(ViolationReportStatus.SUBSTANTIATED, page, limit);
    return { data: items.map(toReportDetailDto), meta: pageMeta(page, limit, total) };
  }
}

@Injectable()
export class ListSanctionsUseCase {
  constructor(@Inject(SANCTION_REPOSITORY_TOKEN) private readonly repository: ISanctionRepository) {}

  async execute(query: ListSanctionsQueryDto, now: Date = new Date()): Promise<PaginatedResponse<SanctionDto>> {
    const { items, total } = await this.repository.list({
      status: query.status,
      type: query.type,
      targetId: query.targetId,
      page: query.page,
      limit: query.limit,
      now,
    });
    return { data: items.map((s) => toSanctionDto(s, now)), meta: pageMeta(query.page, query.limit, total) };
  }
}

@Injectable()
export class GetSanctionUseCase {
  constructor(@Inject(SANCTION_REPOSITORY_TOKEN) private readonly repository: ISanctionRepository) {}

  async execute(id: string): Promise<SanctionDetailDto> {
    const found = await this.repository.findById(id);
    if (!found) {
      throw new NotFoundException({ message: 'Không tìm thấy chế tài.', code: 'SANCTION_NOT_FOUND' });
    }
    return toSanctionDetailDto(found.sanction, found.events);
  }
}

@Injectable()
export class ListMySanctionsUseCase {
  constructor(@Inject(SANCTION_REPOSITORY_TOKEN) private readonly repository: ISanctionRepository) {}

  /** Sinh viên xem chế tài của chính mình (UC60 có actor Sinh viên). */
  async execute(studentId: string, page: number, limit: number): Promise<PaginatedResponse<SanctionDto>> {
    const { items, total } = await this.repository.listByTarget(SanctionTargetType.STUDENT, studentId, page, limit);
    return { data: items.map((s) => toSanctionDto(s)), meta: pageMeta(page, limit, total) };
  }
}
