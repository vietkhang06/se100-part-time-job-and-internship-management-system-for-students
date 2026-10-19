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
import { UpdateCompanyVerificationStatusDto } from '../dto/update-verification-status.dto';

@Injectable()
export class VerifyCompanyUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
  ) {}

  async execute(
    reviewerId: string,
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

    // Rejection reason required when transitioning to REJECTED
    if (
      dto.status === CompanyVerificationStatus.REJECTED &&
      (!dto.rejectionReason || dto.rejectionReason.trim().length === 0)
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Lý do từ chối là bắt buộc khi từ chối xác thực doanh nghiệp.',
        error: 'Bad Request',
        code: CompanyErrorCode.VALIDATION_ERROR,
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
