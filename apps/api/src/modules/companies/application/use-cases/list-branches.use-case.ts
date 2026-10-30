import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyBranchListResponseDto,
  CompanyErrorCode,
} from '@campusjob/contracts';
import {
  ICompanyBranchRepository,
  COMPANY_BRANCH_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-branch.repository.interface';
import {
  ICompanyMemberRepository,
  COMPANY_MEMBER_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-member.repository.interface';

@Injectable()
export class ListBranchesUseCase {
  constructor(
    @Inject(COMPANY_BRANCH_REPOSITORY_TOKEN)
    private readonly branchRepo: ICompanyBranchRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
  ) {}

  async execute(userId: string): Promise<CompanyBranchListResponseDto> {
    const membership = await this.memberRepo.findActiveByUserId(userId);
    if (!membership) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tài khoản chưa được liên kết với doanh nghiệp nào.',
        error: 'Not Found',
        code: CompanyErrorCode.EMPLOYER_HAS_NO_COMPANY,
      });
    }

    const branches = await this.branchRepo.findByCompanyId(
      membership.companyId,
    );

    return {
      message: 'Lấy danh sách chi nhánh thành công.',
      data: branches.map((b) => b.toDto()),
      total: branches.length,
    };
  }
}
