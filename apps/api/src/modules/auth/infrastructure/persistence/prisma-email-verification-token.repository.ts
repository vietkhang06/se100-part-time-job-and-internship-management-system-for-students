import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { IEmailVerificationTokenRepository } from '../../domain/repositories/email-verification-token.repository.interface';
import { EmailVerificationTokenEntity } from '../../domain/entities/email-verification-token.entity';
import { UserStatus } from '@campusjob/contracts';

@Injectable()
export class PrismaEmailVerificationTokenRepository
  implements IEmailVerificationTokenRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): EmailVerificationTokenEntity {
    return new EmailVerificationTokenEntity(
      raw.id,
      raw.userId,
      raw.tokenHash,
      raw.expiresAt,
      raw.usedAt,
      raw.createdAt,
    );
  }

  async create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<EmailVerificationTokenEntity> {
    const raw = await this.prisma.emailVerificationToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
    return this.toDomain(raw);
  }

  async findByTokenHash(tokenHash: string): Promise<EmailVerificationTokenEntity | null> {
    const raw = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findLatestByUserId(userId: string): Promise<EmailVerificationTokenEntity | null> {
    const raw = await this.prisma.emailVerificationToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async invalidatePendingTokensForUser(userId: string): Promise<void> {
    await this.prisma.emailVerificationToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }

  async consumeTokenAndVerifyUser(tokenHash: string, userId: string): Promise<boolean> {
    const now = new Date();
    return await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.emailVerificationToken.updateMany({
        where: {
          tokenHash,
          userId,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      });

      if (updateResult.count === 0) {
        return false;
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          emailVerifiedAt: now,
          status: UserStatus.ACTIVE,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'EMAIL_VERIFIED',
          entityType: 'User',
          entityId: userId,
          metadata: { timestamp: now.toISOString() },
        },
      });

      return true;
    });
  }
}
