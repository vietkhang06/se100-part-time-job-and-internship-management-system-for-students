export class AuthSessionEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenHash: string,
    public readonly tokenFamily: string,
    public readonly expiresAt: Date,
    public readonly revokedAt?: Date | null,
    public readonly userAgent?: string | null,
    public readonly ipAddress?: string | null,
    public readonly createdAt?: Date,
  ) {}

  isRevoked(): boolean {
    return this.revokedAt !== null && this.revokedAt !== undefined;
  }

  isExpired(): boolean {
    return this.expiresAt <= new Date();
  }

  isValid(): boolean {
    return !this.isRevoked() && !this.isExpired();
  }
}
