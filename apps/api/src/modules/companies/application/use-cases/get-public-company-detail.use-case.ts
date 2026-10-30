import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CompanyErrorCode,
  PublicCompanyResponseDto,
} from '@campusjob/contracts';
import {
  ICompanyRepository,
  COMPANY_REPOSITORY_TOKEN,
} from '../../domain/repositories/company.repository.interface';

@Injectable()
export class GetPublicCompanyDetailUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
  ) {}

  async execute(id: string): Promise<PublicCompanyResponseDto> {
    const result = await this.companyRepo.findPublicById(id);

    if (!result) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Doanh nghiệp không tồn tại hoặc chưa được kích hoạt công khai.',
        error: 'Not Found',
        code: CompanyErrorCode.COMPANY_NOT_FOUND,
      });
    }

    const { company, branches, activeJobs } = result;

    return {
      company: {
        ...company.toPublicDto(),
        branches: branches.map((b) => b.toPublicDto()),
        activeJobs: activeJobs.map((j) =>
          j.toPublicDto({
            companyName: company.name,
            companyLogoUrl: company.logoUrl,
          }),
        ),
        // C-18 là DRAFT nên reviewSummary không tích hợp trực tiếp, để null với ghi chú theo dõi
        reviewSummary: null,
      },
    };
  }
}
