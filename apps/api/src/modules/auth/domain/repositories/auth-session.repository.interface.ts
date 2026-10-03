import { AuthSessionEntity } from '../entities/auth-session.entity';

export const AUTH_SESSION_REPOSITORY_TOKEN = Symbol('AUTH_SESSION_REPOSITORY_TOKEN');

export interface CreateAuthSessionData {
  userId: string;
  tokenHash: string;
  tokenFamily: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface IAuthSessionRepository {
  create(data: CreateAuthSessionData): Promise<AuthSessionEntity>;
  findByTokenHash(tokenHash: string): Promise<AuthSessionEntity | null>;
  findById(id: string): Promise<AuthSessionEntity | null>;
  revokeById(id: string): Promise<void>;
  revokeFamily(tokenFamily: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  rotateSession(
    oldSessionId: string,
    newSessionData: CreateAuthSessionData,
  ): Promise<AuthSessionEntity>;
}
