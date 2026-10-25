import {
  CompanyVerificationStatus,
  DocumentType,
  CompanyVerificationDto,
} from '@campusjob/contracts';

export interface VerificationDocumentRecord {
  id: string;
  verificationId: string;
  fileAssetId: string;
  documentType: DocumentType;
  createdAt: Date;
  fileAsset?: {
    id: string;
    originalName: string | null;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: Date;
  } | null;
}

export interface VerificationRecord {
  id: string;
  companyId: string;
  reviewerId: string | null;
  status: CompanyVerificationStatus;
  rejectionReason: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  documents: VerificationDocumentRecord[];
}

export const COMPANY_VERIFICATION_REPOSITORY_TOKEN = Symbol(
  'COMPANY_VERIFICATION_REPOSITORY_TOKEN',
);

export interface ICompanyVerificationRepository {
  createVerification(data: {
    companyId: string;
    status?: CompanyVerificationStatus;
    documents?: { fileAssetId: string; documentType?: DocumentType }[];
  }): Promise<VerificationRecord>;
  findLatestByCompanyId(companyId: string): Promise<VerificationRecord | null>;
  findAllByCompanyId(companyId: string): Promise<VerificationRecord[]>;
  recordDecision(data: {
    verificationId: string;
    reviewerId: string;
    status: CompanyVerificationStatus;
    rejectionReason?: string | null;
  }): Promise<VerificationRecord>;
}
