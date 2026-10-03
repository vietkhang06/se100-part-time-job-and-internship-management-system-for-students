import { UserEntity } from '../entities/user.entity';
import { UserRole, UserStatus } from '@campusjob/contracts';

export const USER_REPOSITORY_TOKEN = Symbol('USER_REPOSITORY_TOKEN');

export interface CreateUserData {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt?: Date | null;
}

export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  create(user: CreateUserData): Promise<UserEntity>;
  createWithVerificationToken(
    user: CreateUserData,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<{ user: UserEntity; tokenId: string }>;
  updateStatus(id: string, status: UserEntity['status']): Promise<UserEntity>;
}
