import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { IPasswordResetTokenRepository } from '../../domain/repositories/password-reset-token.repository.interface';
import { PasswordResetTokenEntity } from '../../domain/entities/password-reset-token.entity';

@Injectable()
export class PrismaPasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): PasswordResetTokenEntity {
    return new PasswordResetTokenEntity(
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
  }): Promise<PasswordResetTokenEntity> {
    const raw = await this.prisma.passwordResetToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
    return this.toDomain(raw);
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetTokenEntity | null> {
    const raw = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findLatestByUserId(userId: string): Promise<PasswordResetTokenEntity | null> {
    const raw = await this.prisma.passwordResetToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async invalidatePendingTokensForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }

  async resetPasswordAndRevokeSessions(
    tokenHash: string,
    userId: string,
    newPasswordHash: string,
  ): Promise<boolean> {
    const now = new Date();
    return await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.passwordResetToken.updateMany({
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

      // Invalidate any other pending reset tokens for this user
      await tx.passwordResetToken.updateMany({
        where: {
          userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      // Update user password
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newPasswordHash,
        },
      });

      // Revoke all existing sessions for this user
      await tx.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'PASSWORD_RESET',
          entityType: 'User',
          entityId: userId,
          metadata: { note: 'Password reset completed and existing sessions revoked' },
        },
      });

      return true;
    });
  }
}
