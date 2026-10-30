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
import { UpdateCompanyBranchDto } from '../dto/update-company-branch.dto';

@Injectable()
export class UpdateBranchUseCase {
  constructor(
    @Inject(COMPANY_BRANCH_REPOSITORY_TOKEN)
    private readonly branchRepo: ICompanyBranchRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
  ) {}

  async execute(
    userId: string,
    branchId: string,
    dto: UpdateCompanyBranchDto,
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

    if (!membership.hasManagementPermission()) {
      throw new ForbiddenException({
        statusCode: 403,
        message:
          'Chỉ chủ sở hữu hoặc quản trị viên doanh nghiệp mới có quyền chỉnh sửa chi nhánh.',
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

    // Tenant isolation: Branch must belong to user's company
    if (branch.companyId !== membership.companyId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không có quyền chỉnh sửa chi nhánh của doanh nghiệp khác.',
        error: 'Forbidden',
        code: CompanyErrorCode.FORBIDDEN,
      });
    }

    // Single headquarter policy
    if (dto.isHeadquarter && !branch.isHeadquarter) {
      await this.branchRepo.unsetHeadquarter(membership.companyId);
    }

    branch.update({
      branchName: dto.branchName,
      addressLine: dto.addressLine,
      ward: dto.ward,
      district: dto.district,
      city: dto.city,
      country: dto.country,
      phone: dto.phone,
      email: dto.email,
      latitude: dto.latitude,
      longitude: dto.longitude,
      isHeadquarter: dto.isHeadquarter,
    });

    const updated = await this.branchRepo.save(branch);

    return {
      message: 'Cập nhật thông tin chi nhánh thành công.',
      branch: updated.toDto(),
    };
  }
}
