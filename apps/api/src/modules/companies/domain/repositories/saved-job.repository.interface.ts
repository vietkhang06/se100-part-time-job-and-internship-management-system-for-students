import { SavedJobEntity } from '../entities/saved-job.entity';

export const SAVED_JOB_REPOSITORY_TOKEN = Symbol('SAVED_JOB_REPOSITORY_TOKEN');

export interface SavedJobWithDetails {
  savedJob: SavedJobEntity;
  isAvailable: boolean;
  companyName: string;
  companyLogoUrl?: string | null;
  branchCity: string;
  branchName: string;
}

export interface ISavedJobRepository {
  save(studentId: string, jobId: string): Promise<SavedJobEntity>;
  unsave(studentId: string, jobId: string): Promise<boolean>;
  findByStudentId(
    studentId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ items: SavedJobWithDetails[]; total: number }>;
  findSavedJobIds(studentId: string): Promise<string[]>;
  isSaved(studentId: string, jobId: string): Promise<boolean>;
  countByJobId(jobId: string): Promise<number>;
  countByJobIds(jobIds: string[]): Promise<Record<string, number>>;
}
