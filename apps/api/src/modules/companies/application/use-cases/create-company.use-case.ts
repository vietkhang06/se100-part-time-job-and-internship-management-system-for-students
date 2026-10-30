import {
  Inject,
  Injectable,
  ConflictException,
} from '@nestjs/common';
import {
  CompanyProfileResponseDto,
  CompanyVerificationStatus,
  CompanyMemberRole,
  CompanyMemberStatus,
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
import { CreateCompanyDto } from '../dto/create-company.dto';

@Injectable()
export class CreateCompanyUseCase {
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
    dto: CreateCompanyDto,
  ): Promise<CompanyProfileResponseDto> {
    // 1. Verify user does not already have an active company membership
    const existingMembership = await this.memberRepo.findActiveByUserId(userId);
    if (existingMembership) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Tài khoản nhà tuyển dụng đã liên kết với một doanh nghiệp.',
        error: 'Conflict',
        code: CompanyErrorCode.VALIDATION_ERROR,
      });
    }

    // 2. Enforce Tax ID unique at database and application levels (Acceptance criteria)
    const existingTaxCompany = await this.companyRepo.findByTaxId(dto.taxId);
    if (existingTaxCompany) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Mã số thuế này đã được đăng ký trên hệ thống.',
        error: 'Conflict',
        code: CompanyErrorCode.TAX_ID_ALREADY_EXISTS,
      });
    }

    // 3. Verify ownership of attached legal documents through FileAssetService
    if (dto.documents && dto.documents.length > 0) {
      for (const doc of dto.documents) {
        await this.fileAssetService.verifyOwnership(doc.fileAssetId, userId);
      }
    }

    // 4. Create company with initial PENDING_REVIEW (Chờ xác thực) status
    const createdCompany = await this.companyRepo.create({
      name: dto.name,
      legalName: dto.legalName,
      representativeName: dto.representativeName,
      taxId: dto.taxId,
      website: dto.website,
      industry: dto.industry,
      companySize: dto.companySize,
      description: dto.description,
      logoUrl: dto.logoUrl,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
    });

    // 5. Create OWNER membership for the creator user
    await this.memberRepo.create({
      companyId: createdCompany.id,
      userId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    // 6. Persist initial verification record with legal documents attached
    await this.verificationRepo.createVerification({
      companyId: createdCompany.id,
      status: CompanyVerificationStatus.PENDING_REVIEW,
      documents: dto.documents?.map((d) => ({
        fileAssetId: d.fileAssetId,
        documentType: d.documentType,
      })),
    });

    return {
      message: 'Khởi tạo hồ sơ doanh nghiệp thành công.',
      company: createdCompany.toDto(),
    };
  }
}
