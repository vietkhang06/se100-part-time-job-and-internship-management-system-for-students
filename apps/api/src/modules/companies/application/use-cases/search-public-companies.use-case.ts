import { Inject, Injectable } from '@nestjs/common';
import { PublicCompanyListResponseDto } from '@campusjob/contracts';
import {
  ICompanyRepository,
  COMPANY_REPOSITORY_TOKEN,
} from '../../domain/repositories/company.repository.interface';
import { PublicCompanyQueryDto } from '../dto/public-company-query.dto';

@Injectable()
export class SearchPublicCompaniesUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
  ) {}

  async execute(query: PublicCompanyQueryDto): Promise<PublicCompanyListResponseDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 10), 50);

    const { companies, total } = await this.companyRepo.searchPublic({
      keyword: query.keyword,
      industry: query.industry,
      city: query.city,
      page,
      limit,
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      companies: companies.map((c) => c.toPublicDto()),
      total,
      page,
      limit,
      totalPages,
    };
  }
}
