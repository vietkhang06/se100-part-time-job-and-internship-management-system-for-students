import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  CompanyProfileResponseDto,
  CompanyVerificationStatus,
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
import { ResubmitVerificationDto } from '../dto/resubmit-verification.dto';

/**
 * S4-M03-02: Cho phép doanh nghiệp nộp lại yêu cầu xác thực.
 * Ràng buộc: Nộp lại không xóa lịch sử cũ, lưu actor/thời gian.
 */
@Injectable()
export class ResubmitCompanyVerificationUseCase {
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
    dto: ResubmitVerificationDto,
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

    if (!membership.hasManagementPermission()) {
      throw new ForbiddenException({
        statusCode: 403,
        message:
          'Chỉ chủ sở hữu hoặc quản trị viên doanh nghiệp mới có quyền gửi lại yêu cầu xác thực.',
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

    // Verify ownership of newly provided documents
    if (dto.documents && dto.documents.length > 0) {
      for (const doc of dto.documents) {
        await this.fileAssetService.verifyOwnership(doc.fileAssetId, userId);
      }
    }

    // Determine documents to associate: new ones or carry forward previous documents
    let documentsToAttach = dto.documents;
    if (!documentsToAttach || documentsToAttach.length === 0) {
      const latest = await this.verificationRepo.findLatestByCompanyId(
        company.id,
      );
      if (latest && latest.documents && latest.documents.length > 0) {
        documentsToAttach = latest.documents.map((d) => ({
          fileAssetId: d.fileAssetId,
          documentType: d.documentType,
        }));
      }
    }

    // Create a new verification record: "nộp lại không xóa lịch sử cũ"
    await this.verificationRepo.createVerification({
      companyId: company.id,
      status: CompanyVerificationStatus.PENDING_REVIEW,
      documents: documentsToAttach?.map((d) => ({
        fileAssetId: d.fileAssetId,
        documentType: d.documentType,
      })),
    });

    company.setVerificationStatus(CompanyVerificationStatus.PENDING_REVIEW);
    const updated = await this.companyRepo.save(company);

    return {
      message: 'Gửi lại yêu cầu xác thực doanh nghiệp thành công.',
      company: updated.toDto(),
    };
  }
}
