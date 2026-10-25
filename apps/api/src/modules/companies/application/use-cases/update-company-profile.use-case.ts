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
import {
  ICompanyVerificationRepository,
  COMPANY_VERIFICATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-verification.repository.interface';
import { FileAssetService } from '../../../../shared/storage/file-asset.service';
import { UpdateCompanyProfileDto } from '../dto/update-company-profile.dto';

@Injectable()
export class UpdateCompanyProfileUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
    @Inject(COMPANY_VERIFICATION_REPOSITORY_TOKEN)
    private readonly verificationRepo: ICompanyVerificationRepository,
    private readonly fileAssetService: FileAssetService,
  ) {}

  async execute(
    userId: string,
    targetCompanyId: string | undefined,
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

    // Role authorization: Only Employer with management permission (OWNER, ADMIN, HR_MANAGER)
    if (!membership.hasManagementPermission()) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Chỉ chủ sở hữu hoặc quản trị viên doanh nghiệp mới có quyền chỉnh sửa hồ sơ.',
        error: 'Forbidden',
        code: CompanyErrorCode.FORBIDDEN,
      });
    }

    // Tenant isolation: Cannot edit another company
    const companyIdToUpdate = targetCompanyId ?? membership.companyId;
    if (companyIdToUpdate !== membership.companyId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không có quyền chỉnh sửa thông tin của doanh nghiệp khác.',
        error: 'Forbidden',
        code: CompanyErrorCode.FORBIDDEN,
      });
    }

    const company = await this.companyRepo.findById(companyIdToUpdate);
    if (!company) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy thông tin doanh nghiệp.',
        error: 'Not Found',
        code: CompanyErrorCode.COMPANY_NOT_FOUND,
      });
    }

    // If documents are attached, verify ownership via FileAssetService
    if (dto.documents && dto.documents.length > 0) {
      for (const doc of dto.documents) {
        await this.fileAssetService.verifyOwnership(doc.fileAssetId, userId);
      }
    }

    // Update allowed fields
    company.updateProfile({
      name: dto.name,
      legalName: dto.legalName,
      representativeName: dto.representativeName,
      website: dto.website,
      industry: dto.industry,
      companySize: dto.companySize,
      description: dto.description,
      logoUrl: dto.logoUrl,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
    });

    const updated = await this.companyRepo.save(company);

    return {
      message: 'Cập nhật hồ sơ doanh nghiệp thành công.',
      company: updated.toDto(),
    };
  }
}
