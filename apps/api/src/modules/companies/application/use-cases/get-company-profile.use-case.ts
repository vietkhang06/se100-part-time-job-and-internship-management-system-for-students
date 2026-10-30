import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyProfileResponseDto,
  CompanyErrorCode,
} from '@campusjob/contracts';
import {
  ICompanyRepository,
  COMPANY_REPOSITORY_TOKEN,
} from '../../domain/repositories/company.repository.interface';
import {
  ICompanyMemberRepository,
  COMPANY_MEMBER_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-member.repository.interface';

@Injectable()
export class GetCompanyProfileUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
  ) {}

  async execute(userId: string): Promise<CompanyProfileResponseDto> {
    const membership = await this.memberRepo.findActiveByUserId(userId);
    if (!membership) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tài khoản chưa được liên kết với doanh nghiệp nào.',
        error: 'Not Found',
        code: CompanyErrorCode.EMPLOYER_HAS_NO_COMPANY,
      });
    }

    const company = await this.companyRepo.findById(membership.companyId);
    if (!company) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy thông tin doanh nghiệp.',
        error: 'Not Found',
        code: CompanyErrorCode.COMPANY_NOT_FOUND,
      });
    }

    return {
      message: 'Lấy thông tin hồ sơ doanh nghiệp thành công.',
      company: company.toDto(),
    };
  }
}
