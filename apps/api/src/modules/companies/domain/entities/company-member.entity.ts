import {
  CompanyMemberDto,
  CompanyMemberRole,
  CompanyMemberStatus,
} from '@campusjob/contracts';

export interface CompanyMemberProps {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyMemberRole;
  status: CompanyMemberStatus;
  joinedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CompanyMemberEntity {
  private readonly _id: string;
  private readonly _companyId: string;
  private readonly _userId: string;
  private _role: CompanyMemberRole;
  private _status: CompanyMemberStatus;
  private readonly _joinedAt: Date;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: CompanyMemberProps) {
    this._id = props.id;
    this._companyId = props.companyId;
    this._userId = props.userId;
    this._role = props.role;
    this._status = props.status;
    this._joinedAt = props.joinedAt ?? new Date();
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  get id(): string {
    return this._id;
  }

  get companyId(): string {
    return this._companyId;
  }

  get userId(): string {
    return this._userId;
  }

  get role(): CompanyMemberRole {
    return this._role;
  }

  get status(): CompanyMemberStatus {
    return this._status;
  }

  get joinedAt(): Date {
    return this._joinedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  isActive(): boolean {
    return this._status === CompanyMemberStatus.ACTIVE;
  }

  hasManagementPermission(): boolean {
    return (
      this.isActive() &&
      (this._role === CompanyMemberRole.OWNER ||
        this._role === CompanyMemberRole.ADMIN ||
        this._role === CompanyMemberRole.HR_MANAGER)
    );
  }

  toDto(): CompanyMemberDto {
    return {
      id: this._id,
      companyId: this._companyId,
      userId: this._userId,
      role: this._role,
      status: this._status,
      joinedAt: this._joinedAt.toISOString(),
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
