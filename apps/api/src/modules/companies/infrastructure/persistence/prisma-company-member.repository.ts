import { Injectable } from '@nestjs/common';
import type { CompanyMember } from '@prisma/client';
import {
  CompanyMemberRole,
  CompanyMemberStatus,
} from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { ICompanyMemberRepository } from '../../domain/repositories/company-member.repository.interface';
import { CompanyMemberEntity } from '../../domain/entities/company-member.entity';

@Injectable()
export class PrismaCompanyMemberRepository
  implements ICompanyMemberRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: CompanyMember): CompanyMemberEntity {
    return new CompanyMemberEntity({
      id: raw.id,
      companyId: raw.companyId,
      userId: raw.userId,
      role: raw.role as CompanyMemberRole,
      status: raw.status as CompanyMemberStatus,
      joinedAt: raw.joinedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  async findByCompanyAndUser(
    companyId: string,
    userId: string,
  ): Promise<CompanyMemberEntity | null> {
    const row = await this.prisma.companyMember.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async findActiveByUserId(userId: string): Promise<CompanyMemberEntity | null> {
    const row = await this.prisma.companyMember.findFirst({
      where: {
        userId,
        status: CompanyMemberStatus.ACTIVE,
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAllByUserId(userId: string): Promise<CompanyMemberEntity[]> {
    const rows = await this.prisma.companyMember.findMany({
      where: { userId },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async create(data: {
    companyId: string;
    userId: string;
    role?: CompanyMemberRole;
    status?: CompanyMemberStatus;
  }): Promise<CompanyMemberEntity> {
    const created = await this.prisma.companyMember.create({
      data: {
        companyId: data.companyId,
        userId: data.userId,
        role: data.role ?? CompanyMemberRole.MEMBER,
        status: data.status ?? CompanyMemberStatus.ACTIVE,
      },
    });
    return this.toDomain(created);
  }

  async save(member: CompanyMemberEntity): Promise<CompanyMemberEntity> {
    const updated = await this.prisma.companyMember.update({
      where: { id: member.id },
      data: {
        role: member.role,
        status: member.status,
      },
    });
    return this.toDomain(updated);
  }
}
