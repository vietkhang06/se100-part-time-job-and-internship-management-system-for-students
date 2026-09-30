import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { UserEntity } from '../../domain/entities/user.entity';
import { UserRole, UserStatus } from '@campusjob/contracts';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): UserEntity {
    return new UserEntity(
      raw.id,
      raw.email,
      raw.passwordHash,
      raw.fullName,
      raw.role as UserRole,
      raw.status as UserStatus,
      raw.phone,
      raw.emailVerifiedAt,
      raw.createdAt,
      raw.updatedAt,
    );
  }

  async findById(id: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findUnique({ where: { id } });
    return raw ? this.toDomain(raw) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const raw = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    return raw ? this.toDomain(raw) : null;
  }

  async create(user: Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserEntity> {
    const raw = await this.prisma.user.create({
      data: {
        email: user.email.toLowerCase().trim(),
        passwordHash: user.passwordHash,
        fullName: user.fullName,
        phone: user.phone ?? null,
        role: user.role,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt ?? null,
      },
    });
    return this.toDomain(raw);
  }

  async updateStatus(id: string, status: UserEntity['status']): Promise<UserEntity> {
    const raw = await this.prisma.user.update({
      where: { id },
      data: { status },
    });
    return this.toDomain(raw);
  }
}
