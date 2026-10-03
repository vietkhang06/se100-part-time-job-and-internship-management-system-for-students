import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  IAuthSessionRepository,
  CreateAuthSessionData,
} from '../../domain/repositories/auth-session.repository.interface';
import { AuthSessionEntity } from '../../domain/entities/auth-session.entity';

@Injectable()
export class PrismaAuthSessionRepository implements IAuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): AuthSessionEntity {
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

  async create(data: CreateAuthSessionData): Promise<AuthSessionEntity> {
    const raw = await this.prisma.authSession.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        tokenFamily: data.tokenFamily,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent ?? null,
        ipAddress: data.ipAddress ?? null,
      },
    });
    return this.toDomain(raw);
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
    const now = new Date();
    return await this.prisma.$transaction(async (tx) => {
      await tx.authSession.update({
        where: { id: oldSessionId },
        data: { revokedAt: now },
      });

      const raw = await tx.authSession.create({
        data: {
          userId: newSessionData.userId,
          tokenHash: newSessionData.tokenHash,
          tokenFamily: newSessionData.tokenFamily,
          expiresAt: newSessionData.expiresAt,
          userAgent: newSessionData.userAgent ?? null,
          ipAddress: newSessionData.ipAddress ?? null,
        },
      });

      return this.toDomain(raw);
    });
  }
}
