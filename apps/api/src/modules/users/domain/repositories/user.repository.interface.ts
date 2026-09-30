import { UserEntity } from '../entities/user.entity';

export const USER_REPOSITORY_TOKEN = Symbol('USER_REPOSITORY_TOKEN');

export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  create(user: Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserEntity>;
  updateStatus(id: string, status: UserEntity['status']): Promise<UserEntity>;
}
