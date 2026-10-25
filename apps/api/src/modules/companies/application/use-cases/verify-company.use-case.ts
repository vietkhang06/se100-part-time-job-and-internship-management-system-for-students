import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  CompanyResponseDto,
  CompanyVerificationStatus,
  CompanyErrorCode,
} from '@campusjob/contracts';
import {
  ICompanyRepository,
  COMPANY_REPOSITORY_TOKEN,
} from '../../domain/repositories/company.repository.interface';
import {
  ICompanyVerificationRepository,
  COMPANY_VERIFICATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-verification.repository.interface';
import { UpdateCompanyVerificationStatusDto } from '../dto/update-verification-status.dto';

/**
 * S4-M03-02 / UC56: Duyệt hoặc từ chối xác thực hồ sơ doanh nghiệp.
 * Ràng buộc: Chỉ Admin ra quyết định; hồ sơ thiếu giấy tờ không được duyệt;
 * từ chối phải có lý do; lưu actor/thời gian/lịch sử.
 */
@Injectable()
export class VerifyCompanyUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
    @Inject(COMPANY_VERIFICATION_REPOSITORY_TOKEN)
    private readonly verificationRepo: ICompanyVerificationRepository,
  ) {}

  async execute(
    adminUserId: string,
    companyId: string,
    dto: UpdateCompanyVerificationStatusDto,
  ): Promise<CompanyResponseDto> {
    const company = await this.companyRepo.findById(companyId);
    if (!company) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy thông tin doanh nghiệp.',
        error: 'Not Found',
        code: CompanyErrorCode.COMPANY_NOT_FOUND,
      });
    }

    // Enforce valid verification state machine transitions
    if (!company.canTransitionTo(dto.status)) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Không thể chuyển trạng thái xác thực từ ${company.verificationStatus} sang ${dto.status}.`,
        error: 'Bad Request',
        code: CompanyErrorCode.INVALID_VERIFICATION_STATE,
      });
    }

    const latestVerification = await this.verificationRepo.findLatestByCompanyId(
      companyId,
    );

    // Acceptance criterion: "hồ sơ thiếu giấy tờ không được duyệt"
    if (dto.status === CompanyVerificationStatus.VERIFIED) {
      if (
        !latestVerification ||
        !latestVerification.documents ||
        latestVerification.documents.length === 0
      ) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Hồ sơ thiếu giấy tờ pháp lý, không thể phê duyệt.',
          error: 'Bad Request',
          code: CompanyErrorCode.DOCUMENTS_REQUIRED,
        });
      }
    }

    // Acceptance criterion: "từ chối bắt buộc lý do"
    if (dto.status === CompanyVerificationStatus.REJECTED) {
      if (!dto.rejectionReason || dto.rejectionReason.trim().length === 0) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Lý do từ chối là bắt buộc khi từ chối xác thực doanh nghiệp.',
          error: 'Bad Request',
          code: CompanyErrorCode.REJECTION_REASON_REQUIRED,
        });
      }
    }

    // Persist decision actor, timestamp, and update the verification history record
    if (latestVerification) {
      await this.verificationRepo.recordDecision({
        verificationId: latestVerification.id,
        reviewerId: adminUserId,
        status: dto.status,
        rejectionReason: dto.rejectionReason,
      });
    } else {
      // If no verification record existed, create one with the decision
      await this.verificationRepo.createVerification({
        companyId: company.id,
        status: dto.status,
      });
    }

    company.setVerificationStatus(dto.status);
    const updated = await this.companyRepo.save(company);

    return {
      message: 'Cập nhật trạng thái xác thực doanh nghiệp thành công.',
      company: updated.toDto(),
    };
  }
}
