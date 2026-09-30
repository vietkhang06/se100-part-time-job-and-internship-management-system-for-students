import { UserRole, UserStatus } from '@campusjob/contracts';

export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly fullName: string,
    public readonly role: UserRole,
    public readonly status: UserStatus,
    public readonly phone?: string | null,
    public readonly emailVerifiedAt?: Date | null,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
  ) {}

  isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  isVerified(): boolean {
    return this.emailVerifiedAt !== null && this.emailVerifiedAt !== undefined;
  }
}
