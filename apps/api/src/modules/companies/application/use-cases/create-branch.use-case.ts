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
import { CreateCompanyBranchDto } from '../dto/create-company-branch.dto';

@Injectable()
export class CreateBranchUseCase {
  constructor(
    @Inject(COMPANY_BRANCH_REPOSITORY_TOKEN)
    private readonly branchRepo: ICompanyBranchRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
  ) {}

  async execute(
    userId: string,
    dto: CreateCompanyBranchDto,
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
          'Chỉ chủ sở hữu hoặc quản trị viên doanh nghiệp mới có quyền tạo chi nhánh.',
        error: 'Forbidden',
        code: CompanyErrorCode.FORBIDDEN,
      });
    }

    // Single headquarter policy
    if (dto.isHeadquarter) {
      await this.branchRepo.unsetHeadquarter(membership.companyId);
    }

    const created = await this.branchRepo.create({
      companyId: membership.companyId,
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

    return {
      message: 'Tạo chi nhánh mới thành công.',
      branch: created.toDto(),
    };
  }
}
