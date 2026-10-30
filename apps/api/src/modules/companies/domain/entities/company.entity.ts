import { CompanyDto, CompanyVerificationStatus } from '@campusjob/contracts';

export interface CompanyProps {
  id: string;
  name: string;
  legalName?: string | null;
  representativeName?: string | null;
  taxId: string;
  website?: string | null;
  industry?: string | null;
  companySize?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  verificationStatus: CompanyVerificationStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CompanyEntity {
  private readonly _id: string;
  private _name: string;
  private _legalName: string | null;
  private _representativeName: string | null;
  private readonly _taxId: string;
  private _website: string | null;
  private _industry: string | null;
  private _companySize: string | null;
  private _description: string | null;
  private _logoUrl: string | null;
  private _email: string | null;
  private _phone: string | null;
  private _address: string | null;
  private _verificationStatus: CompanyVerificationStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: CompanyProps) {
    this._id = props.id;
    this._name = props.name;
    this._legalName = props.legalName ?? null;
    this._representativeName = props.representativeName ?? null;
    this._taxId = props.taxId;
    this._website = props.website ?? null;
    this._industry = props.industry ?? null;
    this._companySize = props.companySize ?? null;
    this._description = props.description ?? null;
    this._logoUrl = props.logoUrl ?? null;
    this._email = props.email ?? null;
    this._phone = props.phone ?? null;
    this._address = props.address ?? null;
    this._verificationStatus = props.verificationStatus;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get legalName(): string | null {
    return this._legalName;
  }

  get representativeName(): string | null {
    return this._representativeName;
  }

  get taxId(): string {
    return this._taxId;
  }

  get website(): string | null {
    return this._website;
  }

  get industry(): string | null {
    return this._industry;
  }

  get companySize(): string | null {
    return this._companySize;
  }

  get description(): string | null {
    return this._description;
  }

  get logoUrl(): string | null {
    return this._logoUrl;
  }

  get email(): string | null {
    return this._email;
  }

  get phone(): string | null {
    return this._phone;
  }

  get address(): string | null {
    return this._address;
  }

  get verificationStatus(): CompanyVerificationStatus {
    return this._verificationStatus;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Acceptance Criterion: "hồ sơ chưa duyệt không được đăng tin công khai"
   */
  canPublishJob(): boolean {
    return this._verificationStatus === CompanyVerificationStatus.VERIFIED;
  }

  updateProfile(data: {
    name?: string;
    legalName?: string | null;
    representativeName?: string | null;
    website?: string | null;
    industry?: string | null;
    companySize?: string | null;
    description?: string | null;
    logoUrl?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  }): void {
    if (data.name !== undefined) this._name = data.name;
    if (data.legalName !== undefined) this._legalName = data.legalName;
    if (data.representativeName !== undefined) this._representativeName = data.representativeName;
    if (data.website !== undefined) this._website = data.website;
    if (data.industry !== undefined) this._industry = data.industry;
    if (data.companySize !== undefined) this._companySize = data.companySize;
    if (data.description !== undefined) this._description = data.description;
    if (data.logoUrl !== undefined) this._logoUrl = data.logoUrl;
    if (data.email !== undefined) this._email = data.email;
    if (data.phone !== undefined) this._phone = data.phone;
    if (data.address !== undefined) this._address = data.address;

    this._updatedAt = new Date();
  }

  canTransitionTo(newStatus: CompanyVerificationStatus): boolean {
    if (this._verificationStatus === newStatus) {
      return false;
    }

    switch (this._verificationStatus) {
      case CompanyVerificationStatus.UNVERIFIED:
        return (
          newStatus === CompanyVerificationStatus.PENDING_REVIEW ||
          newStatus === CompanyVerificationStatus.VERIFIED ||
          newStatus === CompanyVerificationStatus.REJECTED
        );
      case CompanyVerificationStatus.PENDING_REVIEW:
        return (
          newStatus === CompanyVerificationStatus.VERIFIED ||
          newStatus === CompanyVerificationStatus.REJECTED
        );
      case CompanyVerificationStatus.REJECTED:
        return (
          newStatus === CompanyVerificationStatus.PENDING_REVIEW ||
          newStatus === CompanyVerificationStatus.VERIFIED
        );
      case CompanyVerificationStatus.VERIFIED:
        return newStatus === CompanyVerificationStatus.REJECTED;
      default:
        return false;
    }
  }

  setVerificationStatus(newStatus: CompanyVerificationStatus): void {
    this._verificationStatus = newStatus;
    this._updatedAt = new Date();
  }

  toDto(): CompanyDto {
    return {
      id: this._id,
      name: this._name,
      legalName: this._legalName,
      representativeName: this._representativeName,
      taxId: this._taxId,
      website: this._website,
      industry: this._industry,
      companySize: this._companySize,
      description: this._description,
      logoUrl: this._logoUrl,
      email: this._email,
      phone: this._phone,
      address: this._address,
      verificationStatus: this._verificationStatus,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
