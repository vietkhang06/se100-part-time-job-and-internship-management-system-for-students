import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CompanyVerificationStatus } from '@campusjob/contracts';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { VerifyCompanyUseCase } from './verify-company.use-case';

describe('S2-M03-01: VerifyCompanyUseCase (Verification State Machine)', () => {
  let companyRepo: InMemoryCompanyRepository;
  let verifyUseCase: VerifyCompanyUseCase;

  const reviewerId = 'mod-user-1';
  let companyId: string;

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    verifyUseCase = new VerifyCompanyUseCase(companyRepo);

    const company = await companyRepo.create({
      name: 'Verify Candidate Corp',
      taxId: '0101010101',
      verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
    });
    companyId = company.id;
  });

  it('should transition from PENDING_REVIEW to VERIFIED successfully', async () => {
    const result = await verifyUseCase.execute(reviewerId, companyId, {
      status: CompanyVerificationStatus.VERIFIED,
    });

    expect(result.company.verificationStatus).toBe(
      CompanyVerificationStatus.VERIFIED,
    );

    const inRepo = await companyRepo.findById(companyId);
    expect(inRepo?.verificationStatus).toBe(CompanyVerificationStatus.VERIFIED);
  });

  it('should transition from PENDING_REVIEW to REJECTED with rejection reason', async () => {
    const result = await verifyUseCase.execute(reviewerId, companyId, {
      status: CompanyVerificationStatus.REJECTED,
      rejectionReason: 'Giấy phép kinh doanh đã hết hạn sử dụng.',
    });

    expect(result.company.verificationStatus).toBe(
      CompanyVerificationStatus.REJECTED,
    );
  });

  it('should reject transition to REJECTED if rejection reason is missing', async () => {
    await expect(
      verifyUseCase.execute(reviewerId, companyId, {
        status: CompanyVerificationStatus.REJECTED,
        rejectionReason: '',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject redundant self-transition (VERIFIED -> VERIFIED)', async () => {
    // Move to VERIFIED first
    await verifyUseCase.execute(reviewerId, companyId, {
      status: CompanyVerificationStatus.VERIFIED,
    });

    // Try moving to VERIFIED again
    await expect(
      verifyUseCase.execute(reviewerId, companyId, {
        status: CompanyVerificationStatus.VERIFIED,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should allow transition from REJECTED back to PENDING_REVIEW (re-submission)', async () => {
    // Reject first
    await verifyUseCase.execute(reviewerId, companyId, {
      status: CompanyVerificationStatus.REJECTED,
      rejectionReason: 'Thiếu mộc đỏ doanh nghiệp.',
    });

    // Move back to PENDING_REVIEW
    const resubmitted = await verifyUseCase.execute(reviewerId, companyId, {
      status: CompanyVerificationStatus.PENDING_REVIEW,
    });

    expect(resubmitted.company.verificationStatus).toBe(
      CompanyVerificationStatus.PENDING_REVIEW,
    );
  });

  it('should throw NotFoundException if company does not exist', async () => {
    await expect(
      verifyUseCase.execute(reviewerId, 'non-existent-company', {
        status: CompanyVerificationStatus.VERIFIED,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
