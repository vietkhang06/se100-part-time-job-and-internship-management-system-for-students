import {
  CompanyVerificationStatus,
  DocumentType,
} from '@campusjob/contracts';
import {
  ICompanyVerificationRepository,
  VerificationRecord,
} from '../../domain/repositories/company-verification.repository.interface';

export class InMemoryCompanyVerificationRepository
  implements ICompanyVerificationRepository
{
  public verifications: Map<string, VerificationRecord> = new Map();

  async createVerification(data: {
    companyId: string;
    status?: CompanyVerificationStatus;
    documents?: { fileAssetId: string; documentType?: DocumentType }[];
  }): Promise<VerificationRecord> {
    const id = `verif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const record: VerificationRecord = {
      id,
      companyId: data.companyId,
      reviewerId: null,
      status: data.status ?? CompanyVerificationStatus.PENDING_REVIEW,
      rejectionReason: null,
      submittedAt: now,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
      documents: (data.documents ?? []).map((d, index) => ({
        id: `doc-${Date.now()}-${index}`,
        verificationId: id,
        fileAssetId: d.fileAssetId,
        documentType: d.documentType ?? DocumentType.BUSINESS_LICENSE,
        createdAt: now,
        fileAsset: {
          id: d.fileAssetId,
          originalName: 'license.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          uploadedAt: now,
        },
      })),
    };
    this.verifications.set(id, record);
    return record;
  }

  async findLatestByCompanyId(
    companyId: string,
  ): Promise<VerificationRecord | null> {
    const matching: VerificationRecord[] = [];
    for (const v of this.verifications.values()) {
      if (v.companyId === companyId) {
        matching.push(v);
      }
    }
    matching.sort(
      (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime(),
    );
    return matching[0] ?? null;
  }

  async findAllByCompanyId(companyId: string): Promise<VerificationRecord[]> {
    const matching: VerificationRecord[] = [];
    for (const v of this.verifications.values()) {
      if (v.companyId === companyId) {
        matching.push(v);
      }
    }
    return matching.sort(
      (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime(),
    );
  }

  async recordDecision(data: {
    verificationId: string;
    reviewerId: string;
    status: CompanyVerificationStatus;
    rejectionReason?: string | null;
  }): Promise<VerificationRecord> {
    const record = this.verifications.get(data.verificationId);
    if (!record) {
      throw new Error(`Verification record ${data.verificationId} not found`);
    }
    record.reviewerId = data.reviewerId;
    record.status = data.status;
    record.rejectionReason = data.rejectionReason ?? null;
    record.reviewedAt = new Date();
    record.updatedAt = new Date();
    this.verifications.set(record.id, record);
    return record;
  }
}
