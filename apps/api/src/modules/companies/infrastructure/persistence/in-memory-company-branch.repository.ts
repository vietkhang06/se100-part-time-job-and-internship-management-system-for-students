import { ICompanyBranchRepository } from '../../domain/repositories/company-branch.repository.interface';
import { CompanyBranchEntity } from '../../domain/entities/company-branch.entity';

export class InMemoryCompanyBranchRepository
  implements ICompanyBranchRepository
{
  public branches: Map<string, CompanyBranchEntity> = new Map();
  public inUseBranchIds: Set<string> = new Set();

  async findById(id: string): Promise<CompanyBranchEntity | null> {
    const found = this.branches.get(id);
    return found ? this.clone(found) : null;
  }

  async findByCompanyId(companyId: string): Promise<CompanyBranchEntity[]> {
    const list: CompanyBranchEntity[] = [];
    for (const b of this.branches.values()) {
      if (b.companyId === companyId) {
        list.push(this.clone(b));
      }
    }
    return list.sort(
      (a, b) => (b.isHeadquarter ? 1 : 0) - (a.isHeadquarter ? 1 : 0),
    );
  }

  async create(data: {
    companyId: string;
    branchName: string;
    addressLine: string;
    ward?: string | null;
    district?: string | null;
    city: string;
    country?: string;
    phone?: string | null;
    email?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    isHeadquarter?: boolean;
  }): Promise<CompanyBranchEntity> {
    const id = `branch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const entity = new CompanyBranchEntity({
      id,
      companyId: data.companyId,
      branchName: data.branchName,
      addressLine: data.addressLine,
      ward: data.ward ?? null,
      district: data.district ?? null,
      city: data.city,
      country: data.country ?? 'Vietnam',
      phone: data.phone ?? null,
      email: data.email ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      isHeadquarter: data.isHeadquarter ?? false,
    });
    this.branches.set(id, entity);
    return this.clone(entity);
  }

  async save(branch: CompanyBranchEntity): Promise<CompanyBranchEntity> {
    this.branches.set(branch.id, this.clone(branch));
    return this.clone(branch);
  }

  async delete(id: string): Promise<void> {
    this.branches.delete(id);
  }

  async isBranchInUse(branchId: string): Promise<boolean> {
    return this.inUseBranchIds.has(branchId);
  }

  async unsetHeadquarter(companyId: string): Promise<void> {
    for (const b of this.branches.values()) {
      if (b.companyId === companyId && b.isHeadquarter) {
        b.update({ isHeadquarter: false });
      }
    }
  }

  private clone(entity: CompanyBranchEntity): CompanyBranchEntity {
    return new CompanyBranchEntity({
      id: entity.id,
      companyId: entity.companyId,
      branchName: entity.branchName,
      addressLine: entity.addressLine,
      ward: entity.ward,
      district: entity.district,
      city: entity.city,
      country: entity.country,
      phone: entity.phone,
      email: entity.email,
      latitude: entity.latitude,
      longitude: entity.longitude,
      isHeadquarter: entity.isHeadquarter,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
