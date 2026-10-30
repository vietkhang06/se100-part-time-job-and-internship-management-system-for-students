import { JobStatus, JobType } from '@campusjob/contracts';
import { JobPostingEntity } from '../entities/job-posting.entity';

export const JOB_POSTING_REPOSITORY_TOKEN = Symbol('JOB_POSTING_REPOSITORY_TOKEN');

export interface CreateJobPostingData {
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
  rejectionReason?: string | null;
  rejectedAt?: Date | null;
  hiddenByModeration?: boolean;
}

export interface UpdateJobPostingData {
  branchId?: string;
  title?: string;
  description?: string;
  industry?: string;
  type?: JobType;
  skills?: string[];
  quantity?: number;
  salary?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  isSalaryNegotiable?: boolean;
  schedule?: string | null;
  benefits?: string | null;
  deadline?: Date;
  status?: JobStatus;
  rejectionReason?: string | null;
  rejectedAt?: Date | null;
  hiddenByModeration?: boolean;
}

export interface IJobPostingRepository {
  create(data: CreateJobPostingData): Promise<JobPostingEntity>;
  findById(id: string): Promise<JobPostingEntity | null>;
  findByCompanyId(
    companyId: string,
    options?: { status?: JobStatus; page?: number; limit?: number },
  ): Promise<{ jobs: JobPostingEntity[]; total: number }>;
  update(id: string, data: UpdateJobPostingData): Promise<JobPostingEntity>;
  countByBranchId(branchId: string): Promise<number>;
}
