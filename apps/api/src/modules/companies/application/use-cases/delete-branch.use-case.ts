import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import {
  DeleteCompanyBranchResponseDto,
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
import {
  IJobBranchUsageChecker,
  JOB_BRANCH_USAGE_CHECKER_TOKEN,
} from '../../domain/ports/job-branch-usage-checker.port';

@Injectable()
export class DeleteBranchUseCase {
  constructor(
    @Inject(COMPANY_BRANCH_REPOSITORY_TOKEN)
    private readonly branchRepo: ICompanyBranchRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
    @Optional()
    @Inject(JOB_BRANCH_USAGE_CHECKER_TOKEN)
    private readonly jobBranchChecker?: IJobBranchUsageChecker,
  ) {}

  async execute(
    userId: string,
    branchId: string,
  ): Promise<DeleteCompanyBranchResponseDto> {
    const membership = await this.memberRepo.findActiveByUserId(userId);
    if (!membership) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tài khoản chưa được liên kết với doanh nghiệp nào.',
        error: 'Not Found',
        code: CompanyErrorCode.EMPLOYER_HAS_NO_COMPANY,
      });
    }

    if (!membership.hasManagementPermission()) {
      throw new ForbiddenException({
        statusCode: 403,
        message:
          'Chỉ chủ sở hữu hoặc quản trị viên doanh nghiệp mới có quyền xóa chi nhánh.',
        error: 'Forbidden',
        code: CompanyErrorCode.FORBIDDEN,
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

    // Tenant isolation: Branch must belong to the user's company
    if (branch.companyId !== membership.companyId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không có quyền xóa chi nhánh của doanh nghiệp khác.',
        error: 'Forbidden',
        code: CompanyErrorCode.FORBIDDEN,
      });
    }

    // Acceptance criterion: "không cho xóa chi nhánh đang được tin tuyển dụng tham chiếu"
    const inUseInRepo = await this.branchRepo.isBranchInUse(branchId);
    const inUseInChecker = this.jobBranchChecker
      ? await this.jobBranchChecker.isBranchInUse(branchId)
      : false;

    if (inUseInRepo || inUseInChecker) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Không thể xóa chi nhánh đang được gắn với tin tuyển dụng.',
        error: 'Conflict',
        code: CompanyErrorCode.BRANCH_IN_USE_CANNOT_DELETE,
      });
    }

    await this.branchRepo.delete(branchId);

    return {
      message: 'Xóa chi nhánh thành công.',
      deletedBranchId: branchId,
    };
  }
}
