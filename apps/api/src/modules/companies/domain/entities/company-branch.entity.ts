import { CompanyBranchDto, PublicCompanyBranchDto } from '@campusjob/contracts';

export interface CompanyBranchProps {
  id: string;
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
  createdAt?: Date;
  updatedAt?: Date;
}

export class CompanyBranchEntity {
  private readonly _id: string;
  private readonly _companyId: string;
  private _branchName: string;
  private _addressLine: string;
  private _ward: string | null;
  private _district: string | null;
  private _city: string;
  private _country: string;
  private _phone: string | null;
  private _email: string | null;
  private _latitude: number | null;
  private _longitude: number | null;
  private _isHeadquarter: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: CompanyBranchProps) {
    this._id = props.id;
    this._companyId = props.companyId;
    this._branchName = props.branchName;
    this._addressLine = props.addressLine;
    this._ward = props.ward ?? null;
    this._district = props.district ?? null;
    this._city = props.city;
    this._country = props.country ?? 'Vietnam';
    this._phone = props.phone ?? null;
    this._email = props.email ?? null;
    this._latitude = props.latitude ?? null;
    this._longitude = props.longitude ?? null;
    this._isHeadquarter = props.isHeadquarter ?? false;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  get id(): string {
    return this._id;
  }

  get companyId(): string {
    return this._companyId;
  }

  get branchName(): string {
    return this._branchName;
  }

  get addressLine(): string {
    return this._addressLine;
  }

  get ward(): string | null {
    return this._ward;
  }

  get district(): string | null {
    return this._district;
  }

  get city(): string {
    return this._city;
  }

  get country(): string {
    return this._country;
  }

  get phone(): string | null {
    return this._phone;
  }

  get email(): string | null {
    return this._email;
  }

  get latitude(): number | null {
    return this._latitude;
  }

  get longitude(): number | null {
    return this._longitude;
  }

  get isHeadquarter(): boolean {
    return this._isHeadquarter;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  update(data: {
    branchName?: string;
    addressLine?: string;
    ward?: string | null;
    district?: string | null;
    city?: string;
    country?: string;
    phone?: string | null;
    email?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    isHeadquarter?: boolean;
  }): void {
    if (data.branchName !== undefined) this._branchName = data.branchName;
    if (data.addressLine !== undefined) this._addressLine = data.addressLine;
    if (data.ward !== undefined) this._ward = data.ward;
    if (data.district !== undefined) this._district = data.district;
    if (data.city !== undefined) this._city = data.city;
    if (data.country !== undefined) this._country = data.country;
    if (data.phone !== undefined) this._phone = data.phone;
    if (data.email !== undefined) this._email = data.email;
    if (data.latitude !== undefined) this._latitude = data.latitude;
    if (data.longitude !== undefined) this._longitude = data.longitude;
    if (data.isHeadquarter !== undefined) this._isHeadquarter = data.isHeadquarter;

    this._updatedAt = new Date();
  }

  toDto(): CompanyBranchDto {
    return {
      id: this._id,
      companyId: this._companyId,
      branchName: this._branchName,
      addressLine: this._addressLine,
      ward: this._ward,
      district: this._district,
      city: this._city,
      country: this._country,
      phone: this._phone,
      email: this._email,
      latitude: this._latitude,
      longitude: this._longitude,
      isHeadquarter: this._isHeadquarter,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
  toPublicDto(): PublicCompanyBranchDto {
    return {
      id: this._id,
      companyId: this._companyId,
      branchName: this._branchName,
      addressLine: this._addressLine,
      ward: this._ward,
      district: this._district,
      city: this._city,
      country: this._country,
      phone: this._phone,
      isHeadquarter: this._isHeadquarter,
    };
  }
}
