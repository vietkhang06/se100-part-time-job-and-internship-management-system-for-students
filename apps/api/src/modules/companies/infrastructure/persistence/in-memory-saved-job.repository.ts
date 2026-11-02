import { Injectable } from '@nestjs/common';
import { JobStatus } from '@campusjob/contracts';
import { SavedJobEntity } from '../../domain/entities/saved-job.entity';
import {
  ISavedJobRepository,
  SavedJobWithDetails,
} from '../../domain/repositories/saved-job.repository.interface';
import { InMemoryJobPostingRepository } from './in-memory-job-posting.repository';

@Injectable()
export class InMemorySavedJobRepository implements ISavedJobRepository {
  private savedJobs: Map<string, SavedJobEntity> = new Map();
  private jobRepo?: InMemoryJobPostingRepository;

  constructor(jobRepo?: InMemoryJobPostingRepository) {
    this.jobRepo = jobRepo;
  }

  async save(studentId: string, jobId: string): Promise<SavedJobEntity> {
    const key = `${studentId}:${jobId}`;
    const existing = this.savedJobs.get(key);
    if (existing) {
      return existing;
    }

    const entity = new SavedJobEntity({
      id: `saved-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      studentId,
      jobId,
      createdAt: new Date(),
    });

    this.savedJobs.set(key, entity);
    return entity;
  }

  async unsave(studentId: string, jobId: string): Promise<boolean> {
    const key = `${studentId}:${jobId}`;
    return this.savedJobs.delete(key);
  }

  async findByStudentId(
    studentId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ items: SavedJobWithDetails[]; total: number }> {
    const matched: SavedJobWithDetails[] = [];
    const now = new Date();

    for (const s of this.savedJobs.values()) {
      if (s.studentId !== studentId) continue;

      let isAvailable = true;
      let jobEntity = null;
      if (this.jobRepo) {
        const job = await this.jobRepo.findById(s.jobId);
        jobEntity = job;
        if (
          !job ||
          job.status !== JobStatus.OPEN ||
          job.hiddenByModeration ||
          job.deadline.getTime() <= now.getTime()
        ) {
          isAvailable = false;
        }
      }

      matched.push({
        savedJob: new SavedJobEntity({
          id: s.id,
          studentId: s.studentId,
          jobId: s.jobId,
          createdAt: s.createdAt,
          job: jobEntity,
        }),
        isAvailable,
        companyName: 'Test Company',
        companyLogoUrl: null,
        branchCity: 'Ho Chi Minh',
        branchName: 'Headquarter',
      });
    }

    matched.sort(
      (a, b) => b.savedJob.createdAt.getTime() - a.savedJob.createdAt.getTime(),
    );

    const total = matched.length;
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(Math.max(1, options?.limit ?? 10), 50);
    const skip = (page - 1) * limit;
    const items = matched.slice(skip, skip + limit);

    return { items, total };
  }

  async findSavedJobIds(studentId: string): Promise<string[]> {
    const ids: string[] = [];
    for (const s of this.savedJobs.values()) {
      if (s.studentId === studentId) {
        ids.push(s.jobId);
      }
    }
    return ids;
  }

  async isSaved(studentId: string, jobId: string): Promise<boolean> {
    return this.savedJobs.has(`${studentId}:${jobId}`);
  }

  async countByJobId(jobId: string): Promise<number> {
    let count = 0;
    for (const s of this.savedJobs.values()) {
      if (s.jobId === jobId) count++;
    }
    return count;
  }

  async countByJobIds(jobIds: string[]): Promise<Record<string, number>> {
    const res: Record<string, number> = {};
    for (const id of jobIds) {
      res[id] = 0;
    }
    for (const s of this.savedJobs.values()) {
      if (res[s.jobId] !== undefined) {
        res[s.jobId]++;
      }
    }
    return res;
  }

  clear(): void {
    this.savedJobs.clear();
  }
}
