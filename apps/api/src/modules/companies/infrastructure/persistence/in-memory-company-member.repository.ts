import { ICompanyMemberRepository } from '../../domain/repositories/company-member.repository.interface';
import { CompanyMemberEntity } from '../../domain/entities/company-member.entity';
import { CompanyMemberRole, CompanyMemberStatus } from '@campusjob/contracts';

export class InMemoryCompanyMemberRepository
  implements ICompanyMemberRepository
{
  public members: Map<string, CompanyMemberEntity> = new Map();

  async findByCompanyAndUser(
    companyId: string,
    userId: string,
  ): Promise<CompanyMemberEntity | null> {
    for (const m of this.members.values()) {
      if (m.companyId === companyId && m.userId === userId) {
        return this.clone(m);
      }
    }
    return null;
  }

  async findActiveByUserId(userId: string): Promise<CompanyMemberEntity | null> {
    for (const m of this.members.values()) {
      if (m.userId === userId && m.status === CompanyMemberStatus.ACTIVE) {
        return this.clone(m);
      }
    }
    return null;
  }

  async findAllByUserId(userId: string): Promise<CompanyMemberEntity[]> {
    const list: CompanyMemberEntity[] = [];
    for (const m of this.members.values()) {
      if (m.userId === userId) {
        list.push(this.clone(m));
      }
    }
    return list;
  }

  async create(data: {
    companyId: string;
    userId: string;
    role?: CompanyMemberRole;
    status?: CompanyMemberStatus;
  }): Promise<CompanyMemberEntity> {
    const id = `member-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const entity = new CompanyMemberEntity({
      id,
      companyId: data.companyId,
      userId: data.userId,
      role: data.role ?? CompanyMemberRole.MEMBER,
      status: data.status ?? CompanyMemberStatus.ACTIVE,
    });
    this.members.set(id, entity);
    return this.clone(entity);
  }

  async save(member: CompanyMemberEntity): Promise<CompanyMemberEntity> {
    this.members.set(member.id, this.clone(member));
    return this.clone(member);
  }

  private clone(entity: CompanyMemberEntity): CompanyMemberEntity {
    return new CompanyMemberEntity({
      id: entity.id,
      companyId: entity.companyId,
      userId: entity.userId,
      role: entity.role,
      status: entity.status,
      joinedAt: entity.joinedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
