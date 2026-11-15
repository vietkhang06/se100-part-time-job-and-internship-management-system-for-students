import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthSession, Prisma, UserStatus } from '@prisma/client';
import { AuthErrorCode } from '@campusjob/contracts';
import { lockUserRow } from '../../../../shared/database/lock-user-row';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  IAuthSessionRepository,
  CreateAuthSessionData,
} from '../../domain/repositories/auth-session.repository.interface';
import { AuthSessionEntity } from '../../domain/entities/auth-session.entity';

@Injectable()
export class PrismaAuthSessionRepository implements IAuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: AuthSession): AuthSessionEntity {
    return new AuthSessionEntity(
      raw.id,
      raw.userId,
      raw.tokenHash,
      raw.tokenFamily,
      raw.expiresAt,
      raw.revokedAt,
      raw.userAgent,
      raw.ipAddress,
      raw.createdAt,
    );
  }

  private async requireCurrentAccount(tx: Prisma.TransactionClient, data: CreateAuthSessionData) {
    await lockUserRow(tx, data.userId);
    const account = await tx.user.findUnique({
      where: { id: data.userId },
      select: { status: true, accessTokenVersion: true },
    });
    if (account?.status !== UserStatus.ACTIVE || account.accessTokenVersion !== data.accessTokenVersion) {
      throw new UnauthorizedException({
        message: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',
        code: AuthErrorCode.UNAUTHORIZED,
      });
    }
  }

  private createSession(tx: Prisma.TransactionClient, data: CreateAuthSessionData) {
    return tx.authSession.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        tokenFamily: data.tokenFamily,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent ?? null,
        ipAddress: data.ipAddress ?? null,
      },
    });
  }

  async create(data: CreateAuthSessionData): Promise<AuthSessionEntity> {
    return this.prisma.$transaction(async (tx) => {
      await this.requireCurrentAccount(tx, data);
      return this.toDomain(await this.createSession(tx, data));
    });
  }

  async findByTokenHash(tokenHash: string): Promise<AuthSessionEntity | null> {
    const raw = await this.prisma.authSession.findFirst({
      where: { tokenHash },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async findById(id: string): Promise<AuthSessionEntity | null> {
    const raw = await this.prisma.authSession.findUnique({
      where: { id },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async revokeById(id: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(tokenFamily: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { tokenFamily, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async rotateSession(
    oldSessionId: string,
    newSessionData: CreateAuthSessionData,
  ): Promise<AuthSessionEntity> {
    return this.prisma.$transaction(async (tx) => {
      await this.requireCurrentAccount(tx, newSessionData);
      const now = new Date();
      const revoked = await tx.authSession.updateMany({
        where: { id: oldSessionId, userId: newSessionData.userId, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      if (revoked.count !== 1) {
        throw new UnauthorizedException({
          message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
          code: AuthErrorCode.REFRESH_TOKEN_INVALID,
        });
      }

      return this.toDomain(await this.createSession(tx, newSessionData));
    });
  }
}
