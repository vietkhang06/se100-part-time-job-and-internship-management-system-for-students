import { Injectable } from '@nestjs/common';
import {
  CompanyVerificationStatus,
  DocumentType,
} from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  ICompanyVerificationRepository,
  VerificationRecord,
} from '../../domain/repositories/company-verification.repository.interface';

@Injectable()
export class PrismaCompanyVerificationRepository
  implements ICompanyVerificationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): VerificationRecord {
    return {
      id: raw.id,
      companyId: raw.companyId,
      reviewerId: raw.reviewerId,
      status: raw.status as CompanyVerificationStatus,
      rejectionReason: raw.rejectionReason,
      submittedAt: raw.submittedAt,
      reviewedAt: raw.reviewedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      documents: (raw.documents ?? []).map((d: any) => ({
        id: d.id,
        verificationId: d.verificationId,
        fileAssetId: d.fileAssetId,
        documentType: d.documentType as DocumentType,
        createdAt: d.createdAt,
        fileAsset: d.fileAsset
          ? {
              id: d.fileAsset.id,
              originalName: d.fileAsset.originalName,
              mimeType: d.fileAsset.mimeType,
              sizeBytes: d.fileAsset.sizeBytes,
              uploadedAt: d.fileAsset.uploadedAt,
            }
          : null,
      })),
    };
  }

  async createVerification(data: {
    companyId: string;
    status?: CompanyVerificationStatus;
    documents?: { fileAssetId: string; documentType?: DocumentType }[];
  }): Promise<VerificationRecord> {
    const created = await this.prisma.companyVerification.create({
      data: {
        companyId: data.companyId,
        status: data.status ?? CompanyVerificationStatus.PENDING_REVIEW,
        documents: data.documents && data.documents.length > 0
          ? {
              create: data.documents.map((doc) => ({
                fileAssetId: doc.fileAssetId,
                documentType: doc.documentType ?? DocumentType.BUSINESS_LICENSE,
              })),
            }
          : undefined,
      },
      include: {
        documents: {
          include: {
            fileAsset: true,
          },
        },
      },
    });

    return this.toDomain(created);
  }

  async findLatestByCompanyId(
    companyId: string,
  ): Promise<VerificationRecord | null> {
    const row = await this.prisma.companyVerification.findFirst({
      where: { companyId },
      orderBy: { submittedAt: 'desc' },
      include: {
        documents: {
          include: {
            fileAsset: true,
          },
        },
      },
    });

    return row ? this.toDomain(row) : null;
  }

  async findAllByCompanyId(companyId: string): Promise<VerificationRecord[]> {
    const rows = await this.prisma.companyVerification.findMany({
      where: { companyId },
      orderBy: { submittedAt: 'desc' },
      include: {
        documents: {
          include: {
            fileAsset: true,
          },
        },
      },
    });

    return rows.map((r) => this.toDomain(r));
  }

  async recordDecision(data: {
    verificationId: string;
    reviewerId: string;
    status: CompanyVerificationStatus;
    rejectionReason?: string | null;
  }): Promise<VerificationRecord> {
    const updated = await this.prisma.companyVerification.update({
      where: { id: data.verificationId },
      data: {
        reviewerId: data.reviewerId,
        status: data.status,
        rejectionReason: data.rejectionReason ?? null,
        reviewedAt: new Date(),
      },
      include: {
        documents: {
          include: {
            fileAsset: true,
          },
        },
      },
    });

    return this.toDomain(updated);
  }
}
