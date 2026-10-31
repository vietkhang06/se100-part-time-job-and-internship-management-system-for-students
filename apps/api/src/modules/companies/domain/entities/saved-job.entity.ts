import {
  SavedJobDto,
  SavedJobItemDto,
} from '@campusjob/contracts';
import { JobPostingEntity } from './job-posting.entity';

export interface SavedJobEntityProps {
  id: string;
  studentId: string;
  jobId: string;
  createdAt?: Date;
  job?: JobPostingEntity | null;
}

export class SavedJobEntity {
  private readonly _id: string;
  private readonly _studentId: string;
  private readonly _jobId: string;
  private readonly _createdAt: Date;
  private readonly _job?: JobPostingEntity | null;

  constructor(props: SavedJobEntityProps) {
    this._id = props.id;
    this._studentId = props.studentId;
    this._jobId = props.jobId;
    this._createdAt = props.createdAt ?? new Date();
    this._job = props.job;
  }

  get id(): string {
    return this._id;
  }

  get studentId(): string {
    return this._studentId;
  }

  get jobId(): string {
    return this._jobId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get job(): JobPostingEntity | null | undefined {
    return this._job;
  }

  toDto(): SavedJobDto {
    return {
      id: this._id,
      studentId: this._studentId,
      jobId: this._jobId,
      createdAt: this._createdAt.toISOString(),
      job: this._job ? this._job.toDto() : null,
    };
  }

  toItemDto(options: {
    isAvailable: boolean;
    companyName: string;
    companyLogoUrl?: string | null;
    branchCity: string;
    branchName: string;
  }): SavedJobItemDto {
    return {
      id: this._id,
      studentId: this._studentId,
      jobId: this._jobId,
      createdAt: this._createdAt.toISOString(),
      isAvailable: options.isAvailable,
      job: this._job
        ? {
            id: this._job.id,
            title: this._job.title,
            companyId: this._job.companyId,
            companyName: options.companyName,
            companyLogoUrl: options.companyLogoUrl,
            branchId: this._job.branchId,
            branchCity: options.branchCity,
            branchName: options.branchName,
            type: this._job.type,
            industry: this._job.industry,
            salary: this._job.salary,
            salaryMin: this._job.salaryMin,
            salaryMax: this._job.salaryMax,
            isSalaryNegotiable: this._job.isSalaryNegotiable,
            schedule: this._job.schedule,
            benefits: this._job.benefits,
            deadline: this._job.deadline.toISOString(),
            status: this._job.status,
          }
        : null,
    };
  }
}
