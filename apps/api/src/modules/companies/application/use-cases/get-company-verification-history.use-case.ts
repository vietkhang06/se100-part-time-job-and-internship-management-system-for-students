import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyErrorCode,
  CompanyVerificationDto,
  FileAssetStatus,
} from '@campusjob/contracts';
import {
  ICompanyMemberRepository,
  COMPANY_MEMBER_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-member.repository.interface';
import {
  ICompanyVerificationRepository,
  COMPANY_VERIFICATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-verification.repository.interface';

@Injectable()
export class GetCompanyVerificationHistoryUseCase {
  constructor(
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
    @Inject(COMPANY_VERIFICATION_REPOSITORY_TOKEN)
    private readonly verificationRepo: ICompanyVerificationRepository,
  ) {}

  async execute(
    userId: string,
    isAdmin = false,
    companyId?: string,
  ): Promise<{ data: CompanyVerificationDto[] }> {
    let resolvedCompanyId = companyId;

    if (!isAdmin) {
      const membership = await this.memberRepo.findActiveByUserId(userId);
      if (!membership) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Tài khoản chưa được liên kết với doanh nghiệp nào.',
          error: 'Not Found',
          code: CompanyErrorCode.EMPLOYER_HAS_NO_COMPANY,
        });
      }
      resolvedCompanyId = membership.companyId;
    }

    if (!resolvedCompanyId) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy thông tin doanh nghiệp.',
        error: 'Not Found',
        code: CompanyErrorCode.COMPANY_NOT_FOUND,
      });
    }

    const records = await this.verificationRepo.findAllByCompanyId(
      resolvedCompanyId,
    );

    return {
      data: records.map((r) => ({
        id: r.id,
        companyId: r.companyId,
        reviewerId: r.reviewerId,
        status: r.status,
        rejectionReason: r.rejectionReason,
        submittedAt: r.submittedAt.toISOString(),
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        documents: r.documents.map((d) => ({
          id: d.id,
          verificationId: d.verificationId,
          fileAssetId: d.fileAssetId,
          documentType: d.documentType,
          createdAt: d.createdAt.toISOString(),
          fileAsset: d.fileAsset
            ? {
                id: d.fileAsset.id,
                ownerUserId: '', // sanitize
                originalName: d.fileAsset.originalName,
                mimeType: d.fileAsset.mimeType,
                sizeBytes: d.fileAsset.sizeBytes,
                checksumSha256: '', // sanitize
                storageKey: '', // sanitize: never expose storage keys
                status: FileAssetStatus.PERMANENT,
                uploadedAt: d.fileAsset.uploadedAt.toISOString(),
                updatedAt: d.fileAsset.uploadedAt.toISOString(),
              }
            : null,
        })),
      })),
    };
  }
}
