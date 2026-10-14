import { CvSnapshotDto } from '@campusjob/contracts';
import { ApplicationStatus } from '../domain/application-state';
import { M04Workflow } from './m04-workflow';
import { ApplicationRecord, M04Repository, M04WorkflowError } from './m04-ports';

const snapshot: CvSnapshotDto = {
  snapshotId: 'snap-1', originalCvId: 'cv-1', studentId: 'student-a',
  fullName: 'Candidate A', email: 'a@example.org', title: 'CV A',
  educations: [], experiences: [], skills: ['typescript'], projects: [],
  certifications: [], capturedAt: '2026-10-14T00:00:00.000Z',
};

describe('M04 application slice with fixture sources', () => {
  let records: ApplicationRecord[];
  let workflow: M04Workflow;

  beforeEach(() => {
    records = [];
    const repository: M04Repository = {
      createApplication: async (input) => {
        if (records.some((r) => r.studentId === input.studentId && r.jobId === input.jobId)) {
          throw new M04WorkflowError('DUPLICATE_APPLICATION');
        }
        const record: ApplicationRecord = {
          ...input, id: 'app-1', status: ApplicationStatus.SUBMITTED,
          rejectionReason: null, createdAt: new Date('2026-10-14T00:00:00Z'),
        };
        records.push(record);
        return record;
      },
      getApplication: async (id) => records.find((r) => r.id === id) ?? null,
      listStudentApplications: async (id) => records.filter((r) => r.studentId === id),
      changeApplicationStatus: async ({ id, expected, next }) => {
        const index = records.findIndex((r) => r.id === id && r.status === expected);
        if (index < 0) throw new M04WorkflowError('CONCURRENT_CHANGE');
        records[index] = { ...records[index], status: next };
        return records[index];
      },
    };
    workflow = new M04Workflow(repository,
      { getOwnedSnapshot: async () => snapshot },
      {
        assertAcceptingApplications: async (jobId) => {
          if (jobId !== 'job-a') throw new M04WorkflowError('INVALID_INPUT');
        },
        assertManagedBy: async () => undefined,
      },
    );
  });

  it('stores the selected CV snapshot and prevents a second application to the same job', async () => {
    const application = await workflow.submit('student-a', 'job-a', 'cv-1', ' Hello ');
    expect(application.cvSnapshot).toEqual(snapshot);
    expect(application.coverLetter).toBe('Hello');
    await expect(workflow.submit('student-a', 'job-a', 'cv-1')).rejects.toMatchObject({
      code: 'DUPLICATE_APPLICATION',
    });
  });

  it('limits student reads and withdrawal to the owner and valid state', async () => {
    const application = await workflow.submit('student-a', 'job-a', 'cv-1');
    await expect(workflow.getMine('student-b', application.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await workflow.listMine('student-b')).toEqual([]);
    await expect(workflow.withdraw('student-b', application.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await workflow.withdraw('student-a', application.id)).status).toBe(ApplicationStatus.WITHDRAWN);
    await expect(workflow.withdraw('student-a', application.id)).rejects.toThrow();
  });
});
