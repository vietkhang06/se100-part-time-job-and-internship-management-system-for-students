import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
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
import { UpdateCompanyProfileDto } from '../dto/update-company-profile.dto';

@Injectable()
export class UpdateCompanyProfileUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
  ) {}

  async execute(
    userId: string,
    companyId: string | undefined,
    dto: UpdateCompanyProfileDto,
  ): Promise<CompanyProfileResponseDto> {
    const membership = await this.memberRepo.findActiveByUserId(userId);

    if (!membership) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tài khoản chưa được liên kết với doanh nghiệp nào.',
        error: 'Not Found',
        code: CompanyErrorCode.EMPLOYER_HAS_NO_COMPANY,
      });
    }

    // Cross-company modification attempt rejected
    if (companyId && membership.companyId !== companyId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không có quyền chỉnh sửa thông tin của doanh nghiệp khác.',
        error: 'Forbidden',
        code: CompanyErrorCode.FORBIDDEN,
      });
    }

    // Check RBAC permission for company management
    if (!membership.hasManagementPermission()) {
      throw new ForbiddenException({
        statusCode: 403,
        message:
          'Chỉ chủ sở hữu hoặc quản trị viên doanh nghiệp mới có quyền cập nhật hồ sơ.',
        error: 'Forbidden',
        code: CompanyErrorCode.FORBIDDEN,
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

    // Verification Rule (Section 4.1 & 4.3):
    // Ordinary profile update updates only permissible fields.
    // verificationStatus, taxId, id and members are never modified here.
    // If company is in REJECTED status, ordinary edit leaves it REJECTED.
    company.updateProfile({
      name: dto.name,
      legalName: dto.legalName,
      website: dto.website,
      industry: dto.industry,
      companySize: dto.companySize,
      description: dto.description,
      logoUrl: dto.logoUrl,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
    });

    const savedCompany = await this.companyRepo.save(company);

    return {
      message: 'Cập nhật hồ sơ doanh nghiệp thành công.',
      company: savedCompany.toDto(),
    };
  }
}
