export class CampusEmailVerificationTokenEntity {
  constructor(
    public readonly id: string,
    public readonly studentProfileId: string,
    public readonly campusEmail: string,
    public readonly otpHash: string,
    public readonly attempts: number,
    public readonly maxAttempts: number,
    public readonly expiresAt: Date,
    public readonly usedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  isUsed(): boolean {
    return this.usedAt !== null;
  }

  isExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  hasReachedMaxAttempts(): boolean {
    return this.attempts >= this.maxAttempts;
  }
}

