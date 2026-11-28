import { Injectable } from '@nestjs/common';
import { Prisma, type CampusEmailVerificationToken } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  ConsumeCampusOtpResult,
  ICampusVerificationRepository,
} from '../../domain/repositories/campus-verification.repository.interface';
import { CampusEmailVerificationTokenEntity } from '../../domain/entities/campus-email-verification-token.entity';

@Injectable()
export class PrismaCampusVerificationRepository
  implements ICampusVerificationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(
    raw: CampusEmailVerificationToken,
  ): CampusEmailVerificationTokenEntity {
    return new CampusEmailVerificationTokenEntity(
      raw.id,
      raw.studentProfileId,
      raw.campusEmail,
      raw.otpHash,
      raw.attempts,
      raw.maxAttempts,
      raw.expiresAt,
      raw.usedAt,
      raw.createdAt,
    );
  }

  async findLatestByProfileId(
    studentProfileId: string,
  ): Promise<CampusEmailVerificationTokenEntity | null> {
    const raw = await this.prisma.campusEmailVerificationToken.findFirst({
      where: { studentProfileId },
      orderBy: { createdAt: 'desc' },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findLatestByProfileAndEmail(
    studentProfileId: string,
    campusEmail: string,
  ): Promise<CampusEmailVerificationTokenEntity | null> {
    const raw = await this.prisma.campusEmailVerificationToken.findFirst({
      where: { studentProfileId, campusEmail },
      orderBy: { createdAt: 'desc' },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async countRequestsSince(
    studentProfileId: string,
    since: Date,
  ): Promise<number> {
    return this.prisma.campusEmailVerificationToken.count({
      where: {
        studentProfileId,
        createdAt: { gte: since },
      },
    });
  }

  async createOtpAndInvalidatePending(data: {
    studentProfileId: string;
    campusEmail: string;
    otpHash: string;
    expiresAt: Date;
    maxAttempts: number;
  }): Promise<CampusEmailVerificationTokenEntity> {
    const now = new Date();
    const raw = await this.prisma.$transaction(async (tx) => {
      await tx.campusEmailVerificationToken.updateMany({
        where: {
          studentProfileId: data.studentProfileId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      return tx.campusEmailVerificationToken.create({
        data: {
          studentProfileId: data.studentProfileId,
          campusEmail: data.campusEmail,
          otpHash: data.otpHash,
          expiresAt: data.expiresAt,
          maxAttempts: data.maxAttempts,
        },
      });
    });

    return this.toDomain(raw);
  }

  async deleteTokenById(tokenId: string): Promise<void> {
    await this.prisma.campusEmailVerificationToken.deleteMany({
      where: { id: tokenId },
    });
  }

  async incrementFailedAttempts(
    tokenId: string,
  ): Promise<CampusEmailVerificationTokenEntity | null> {
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.campusEmailVerificationToken.findUnique({
        where: { id: tokenId },
      });
      if (!existing || existing.usedAt !== null) {
        return null;
      }

      const nextAttempts = existing.attempts + 1;
      return tx.campusEmailVerificationToken.update({
        where: { id: tokenId },
        data: {
          attempts: nextAttempts,
          ...(nextAttempts >= existing.maxAttempts ? { usedAt: now } : {}),
        },
      });
    });

    return updated ? this.toDomain(updated) : null;
  }

  async consumeOtpAndVerifyProfile(params: {
    tokenId: string;
    studentProfileId: string;
    userId: string;
    campusEmail: string;
    now: Date;
    maxAttempts: number;
  }): Promise<ConsumeCampusOtpResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const consumeResult = await tx.campusEmailVerificationToken.updateMany({
          where: {
            id: params.tokenId,
            studentProfileId: params.studentProfileId,
            campusEmail: params.campusEmail,
            usedAt: null,
            expiresAt: { gt: params.now },
            attempts: { lt: params.maxAttempts },
          },
          data: {
            usedAt: params.now,
          },
        });

        if (consumeResult.count === 0) {
          return 'TOKEN_INVALID_OR_CONSUMED';
        }

        const existingOwner = await tx.studentProfile.findFirst({
          where: {
            campusEmail: params.campusEmail,
            isCampusVerified: true,
            id: { not: params.studentProfileId },
          },
          select: { id: true },
        });

        if (existingOwner) {
          throw new CampusEmailConflictSignal();
        }

        await tx.studentProfile.update({
          where: { id: params.studentProfileId },
          data: {
            isCampusVerified: true,
            campusEmail: params.campusEmail,
            campusVerifiedAt: params.now,
          },
        });

        await tx.campusEmailVerificationToken.updateMany({
          where: {
            studentProfileId: params.studentProfileId,
            usedAt: null,
          },
          data: {
            usedAt: params.now,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: params.userId,
            action: 'CAMPUS_EMAIL_VERIFIED',
            entityType: 'StudentProfile',
            entityId: params.studentProfileId,
            metadata: {
              campusEmail: params.campusEmail,
              verifiedAt: params.now.toISOString(),
            },
          },
        });

        return 'VERIFIED';
      });
    } catch (err: unknown) {
      if (err instanceof CampusEmailConflictSignal) {
        return 'EMAIL_ALREADY_IN_USE';
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return 'EMAIL_ALREADY_IN_USE';
      }
      throw err;
    }
  }
}

class CampusEmailConflictSignal extends Error {
  constructor() {
    super('CAMPUS_EMAIL_ALREADY_IN_USE');
  }
}

