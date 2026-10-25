import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CompanyBranchResponseDto,
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
export class GetBranchDetailUseCase {
  constructor(
    @Inject(COMPANY_BRANCH_REPOSITORY_TOKEN)
    private readonly branchRepo: ICompanyBranchRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
  ) {}

  async execute(
    userId: string,
    branchId: string,
  ): Promise<CompanyBranchResponseDto> {
    const membership = await this.memberRepo.findActiveByUserId(userId);
    if (!membership) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tài khoản chưa được liên kết với doanh nghiệp nào.',
        error: 'Not Found',
        code: CompanyErrorCode.EMPLOYER_HAS_NO_COMPANY,
      });
    }

    const branch = await this.branchRepo.findById(branchId);
    if (!branch) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy chi nhánh.',
        error: 'Not Found',
        code: CompanyErrorCode.BRANCH_NOT_FOUND,
      });
    }

    // Tenant isolation: Branch must belong to user's company
    if (branch.companyId !== membership.companyId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không có quyền truy cập chi nhánh của doanh nghiệp khác.',
        error: 'Forbidden',
        code: CompanyErrorCode.FORBIDDEN,
      });
    }

    return {
      message: 'Lấy thông tin chi nhánh thành công.',
      branch: branch.toDto(),
    };
  }
}
