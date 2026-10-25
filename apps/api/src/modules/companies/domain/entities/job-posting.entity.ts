import { JobStatus, JobType, JobPostingDto } from '@campusjob/contracts';

export interface JobPostingProps {
  id: string;
  companyId: string;
  branchId: string;
  title: string;
  description: string;
  industry: string;
  type: JobType;
  skills: string[];
  quantity: number;
  salary?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  isSalaryNegotiable?: boolean;
  schedule?: string | null;
  benefits?: string | null;
  deadline: Date;
  status?: JobStatus;
  viewCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class JobPostingEntity {
  readonly id: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly title: string;
  readonly description: string;
  readonly industry: string;
  readonly type: JobType;
  readonly skills: string[];
  readonly quantity: number;
  readonly salary: string | null;
  readonly salaryMin: number | null;
  readonly salaryMax: number | null;
  readonly isSalaryNegotiable: boolean;
  readonly schedule: string | null;
  readonly benefits: string | null;
  readonly deadline: Date;
  readonly status: JobStatus;
  readonly viewCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: JobPostingProps) {
    this.id = props.id;
    this.companyId = props.companyId;
    this.branchId = props.branchId;
    this.title = props.title;
    this.description = props.description;
    this.industry = props.industry;
    this.type = props.type;
    this.skills = props.skills ?? [];
    this.quantity = props.quantity;
    this.salary = props.salary ?? null;
    this.salaryMin = props.salaryMin ?? null;
    this.salaryMax = props.salaryMax ?? null;
    this.isSalaryNegotiable = props.isSalaryNegotiable ?? false;
    this.schedule = props.schedule ?? null;
    this.benefits = props.benefits ?? null;
    this.deadline = props.deadline;
    this.status = props.status ?? JobStatus.PENDING_APPROVAL;
    this.viewCount = props.viewCount ?? 0;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  isExpired(now: Date = new Date()): boolean {
    return this.deadline.getTime() < now.getTime();
  }

  canTransitionTo(nextStatus: JobStatus, isCompanyActive: boolean, now: Date = new Date()): { allowed: boolean; reason?: string } {
    if (this.status === nextStatus) {
      return { allowed: true }; // Idempotent
    }

    switch (this.status) {
      case JobStatus.PENDING_APPROVAL:
        if (nextStatus === JobStatus.OPEN) {
          if (this.isExpired(now)) {
            return { allowed: false, reason: 'Tin tuyển dụng đã hết hạn, không thể duyệt mở.' };
          }
          if (!isCompanyActive) {
            return { allowed: false, reason: 'Doanh nghiệp chưa được xác thực hoặc không ở trạng thái hoạt động.' };
          }
          return { allowed: true };
        }
        if (nextStatus === JobStatus.CLOSED) {
          return { allowed: true };
        }
        return { allowed: false, reason: `Không thể chuyển trạng thái từ ${this.status} sang ${nextStatus}.` };

      case JobStatus.OPEN:
        if (nextStatus === JobStatus.PAUSED) {
          return { allowed: true };
        }
        if (nextStatus === JobStatus.CLOSED) {
          return { allowed: true };
        }
        return { allowed: false, reason: `Không thể chuyển trạng thái từ ${this.status} sang ${nextStatus}.` };

      case JobStatus.PAUSED:
        if (nextStatus === JobStatus.OPEN) {
          if (this.isExpired(now)) {
            return { allowed: false, reason: 'Tin tuyển dụng đã hết hạn, không thể mở lại.' };
          }
          if (!isCompanyActive) {
            return { allowed: false, reason: 'Doanh nghiệp chưa được xác thực hoặc không ở trạng thái hoạt động.' };
          }
          return { allowed: true };
        }
        if (nextStatus === JobStatus.CLOSED) {
          return { allowed: true };
        }
        return { allowed: false, reason: `Không thể chuyển trạng thái từ ${this.status} sang ${nextStatus}.` };

      case JobStatus.CLOSED:
        return { allowed: false, reason: 'Tin tuyển dụng đã đóng, không thể chuyển sang trạng thái khác.' };

      default:
        return { allowed: false, reason: `Trạng thái hiện tại không hợp lệ: ${this.status}.` };
    }
  }

  toDto(): JobPostingDto {
    return {
      id: this.id,
      companyId: this.companyId,
      branchId: this.branchId,
      title: this.title,
      description: this.description,
      industry: this.industry,
      type: this.type,
      skills: this.skills,
      quantity: this.quantity,
      salary: this.salary,
      salaryMin: this.salaryMin,
      salaryMax: this.salaryMax,
      isSalaryNegotiable: this.isSalaryNegotiable,
      schedule: this.schedule,
      benefits: this.benefits,
      deadline: this.deadline.toISOString(),
      status: this.status,
      viewCount: this.viewCount,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
