import { CvSnapshotSource, JobAccessSource, M04Repository, M04WorkflowError, ApplicationRecord } from './m04-ports';
import { ApplicationStatus, nextApplicationStatus } from '../domain/application-state';
import { UserRole } from '@campusjob/contracts';

/** M04 workflow. CV and Job decisions stay with the owning modules via ports. */
export class M04Workflow {
  constructor(
    private readonly repository: M04Repository,
    private readonly cvs: CvSnapshotSource,
    private readonly jobs: JobAccessSource,
  ) {}

  async submit(studentId: string, jobId: string, cvId: string, coverLetter?: string): Promise<ApplicationRecord> {
    await this.jobs.assertAcceptingApplications(jobId);
    const cvSnapshot = await this.cvs.getOwnedSnapshot(studentId, cvId);
    if (cvSnapshot.studentId !== studentId || cvSnapshot.originalCvId !== cvId) {
      throw new M04WorkflowError('FORBIDDEN');
    }
    return this.repository.createApplication({
      studentId, jobId, cvId, cvSnapshot, coverLetter: coverLetter?.trim() || null,
    });
  }

  listMine(studentId: string): Promise<ApplicationRecord[]> {
    return this.repository.listStudentApplications(studentId);
  }

  async getMine(studentId: string, id: string): Promise<ApplicationRecord> {
    const application = await this.requireApplication(id);
    if (application.studentId !== studentId) throw new M04WorkflowError('NOT_FOUND');
    return application;
  }

  async withdraw(studentId: string, id: string): Promise<ApplicationRecord> {
    const application = await this.getMine(studentId, id);
    const next = nextApplicationStatus(application.status, 'WITHDRAW', UserRole.STUDENT);
    return this.repository.changeApplicationStatus({ id, expected: application.status, next, actorId: studentId });
  }

  async listCandidates(employerId: string, jobId: string): Promise<ApplicationRecord[]> {
    await this.jobs.assertManagedBy(jobId, employerId);
    const applications = await this.repository.listJobApplications(jobId);
    return applications.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getCandidate(employerId: string, id: string): Promise<ApplicationRecord> {
    const application = await this.requireApplication(id);
    await this.jobs.assertManagedBy(application.jobId, employerId);
    return application;
  }

  async markViewed(employerId: string, id: string): Promise<ApplicationRecord> {
    const application = await this.getCandidate(employerId, id);
    const next = nextApplicationStatus(application.status, 'MARK_VIEWED', UserRole.EMPLOYER);
    return this.repository.changeApplicationStatus({ id, expected: application.status, next, actorId: employerId });
  }

  async reject(employerId: string, id: string, reason: string): Promise<ApplicationRecord> {
    if (!reason.trim()) throw new M04WorkflowError('INVALID_INPUT');
    const application = await this.getCandidate(employerId, id);
    const next = nextApplicationStatus(application.status, 'REJECT', UserRole.EMPLOYER);
    return this.repository.changeApplicationStatus({ id, expected: application.status, next, actorId: employerId, reason: reason.trim() });
  }

  private async requireApplication(id: string): Promise<ApplicationRecord> {
    const application = await this.repository.getApplication(id);
    if (!application) throw new M04WorkflowError('NOT_FOUND');
    return application;
  }
}
