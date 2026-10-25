/**
 * S3-M04-01 supporting regression: real Prisma repository + PostgreSQL.
 * This is NOT HTTP or M02/M03/M05 E2E. No business adapters are substituted.
 * Inputs below exercise the persistence boundary, not CV/job eligibility.
 */
import { randomUUID } from 'crypto';
import { CvSnapshotDto } from '@campusjob/contracts';
import { PrismaService } from '../src/shared/database/prisma.service';
import { PrismaM04Repository } from '../src/modules/applications/infrastructure/prisma-m04.repository';
import { ApplicationStatus as S } from '../src/modules/applications/domain/application-state';

describe('S3-M04-01 PostgreSQL persistence regression (not full integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaM04Repository;
  let studentId: string;
  let jobId: string;
  const actorId = 'm04-regression-employer';
  const now = new Date('2035-01-01T00:00:00.000Z');
  const scheduledAt = new Date('2035-01-02T00:00:00.000Z');
  const later = new Date('2035-01-03T00:00:00.000Z');
  const afterInterview = new Date('2035-01-04T00:00:00.000Z');

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const [target] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    if (target.name !== 'campusjob_m04_test') throw new Error('Unexpected M04 test database');
    repository = new PrismaM04Repository(prisma);
  });
  beforeEach(() => {
    studentId = `m04-regression-${randomUUID()}`;
    jobId = randomUUID();
  });
  afterEach(async () => {
    // Delete only records owned by this case; child rows cascade.
    if (prisma && studentId) await prisma.application.deleteMany({ where: { studentId } });
  });
  afterAll(async () => { if (prisma) await prisma.$disconnect(); });

  function create() {
    const cvId = randomUUID();
    const cvSnapshot: CvSnapshotDto = {
      snapshotId: randomUUID(), originalCvId: cvId, studentId,
      fullName: 'M04 repository regression', email: 'm04@example.test',
      title: 'Submitted content', educations: [], experiences: [],
      skills: ['TypeScript'], projects: [], certifications: [],
      capturedAt: now.toISOString(),
    };
    return { input: { studentId, jobId, cvId, cvSnapshot, coverLetter: null } };
  }
  async function reviewing() {
    const application = await repository.createApplication(create().input);
    return repository.changeApplicationStatus({
      id: application.id, expected: S.SUBMITTED, next: S.REVIEWING, actorId,
    });
  }
  async function invited() {
    const application = await reviewing();
    const interview = await repository.createInterview({
      applicationId: application.id, actorId, scheduledAt,
      mode: 'ONLINE', locationOrLink: 'https://example.test/interview', message: null,
    });
    return { application, interview };
  }
  function expectSingleWinner(results: PromiseSettledResult<unknown>[]) {
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
  }

  it('DB01 stores the submitted snapshot and initial history atomically', async () => {
    const { input } = create();
    const application = await repository.createApplication(input);
    input.cvSnapshot.title = 'Changed caller object';
    expect((await repository.getApplication(application.id))?.cvSnapshot.title).toBe('Submitted content');
    expect(await prisma.applicationStatusHistory.findMany({ where: { applicationId: application.id } }))
      .toEqual([expect.objectContaining({ actorId: studentId, fromStatus: null, toStatus: S.SUBMITTED })]);
  });

  it('DB02 concurrent duplicate submissions create one application and one initial history', async () => {
    const { input } = create();
    const results = await Promise.allSettled([
      repository.createApplication(input), repository.createApplication(input),
    ]);
    expectSingleWinner(results);
    const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'DUPLICATE_APPLICATION' });
    expect(await prisma.application.count({ where: { studentId, jobId } })).toBe(1);
    expect(await prisma.applicationStatusHistory.count({ where: { application: { studentId } } })).toBe(1);
  });

  it('DB03 stale status writes roll back without adding history', async () => {
    const application = await reviewing();
    await expect(repository.changeApplicationStatus({
      id: application.id, expected: S.SUBMITTED, next: S.WITHDRAWN, actorId: studentId,
    })).rejects.toMatchObject({ code: 'CONCURRENT_CHANGE' });
    expect((await repository.getApplication(application.id))?.status).toBe(S.REVIEWING);
    expect(await prisma.applicationStatusHistory.count({ where: { applicationId: application.id } })).toBe(2);
  });

  it('DB04 concurrent invitations create one interview and one transition', async () => {
    const application = await reviewing();
    const input = { applicationId: application.id, actorId, scheduledAt,
      mode: 'ONLINE' as const, locationOrLink: 'https://example.test/interview', message: null };
    expectSingleWinner(await Promise.allSettled([
      repository.createInterview(input), repository.createInterview(input),
    ]));
    expect((await repository.getApplication(application.id))?.status).toBe(S.INTERVIEW_SCHEDULED);
    expect(await prisma.interview.count({ where: { applicationId: application.id } })).toBe(1);
    expect(await prisma.applicationStatusHistory.count({
      where: { applicationId: application.id, toStatus: S.INTERVIEW_SCHEDULED },
    })).toBe(1);
  });

  it('DB05 concurrent confirmations persist one response', async () => {
    const { interview } = await invited();
    expectSingleWinner(await Promise.allSettled([
      repository.confirmInterview(interview.id, now), repository.confirmInterview(interview.id, now),
    ]));
    expect((await repository.getInterview(interview.id))?.confirmedAt).toEqual(now);
  });

  it('DB06 concurrent change requests persist only one request', async () => {
    const { interview } = await invited();
    const input = { interviewId: interview.id, proposedAt: later, message: 'Please reschedule' };
    expectSingleWinner(await Promise.allSettled([
      repository.createChangeRequest(input), repository.createChangeRequest(input),
    ]));
    expect(await prisma.interviewChangeRequest.count({ where: { interviewId: interview.id } })).toBe(1);
  });

  it('DB07 approval updates the schedule once; a repeated decision cannot overwrite it', async () => {
    const { interview } = await invited();
    await repository.createChangeRequest({ interviewId: interview.id, proposedAt: later, message: null });
    await repository.decideChangeRequest({ interviewId: interview.id, decision: 'APPROVED', decidedBy: actorId, at: now });
    await expect(repository.decideChangeRequest({
      interviewId: interview.id, decision: 'REJECTED', decidedBy: actorId, at: now,
    })).rejects.toMatchObject({ code: 'CONCURRENT_CHANGE' });
    expect((await repository.getInterview(interview.id))?.scheduledAt).toEqual(later);
    expect((await repository.getChangeRequest(interview.id))?.decision).toBe('APPROVED');
  });

  it('DB08 rejection keeps the original schedule and prevents a later approval', async () => {
    const { interview } = await invited();
    await repository.createChangeRequest({ interviewId: interview.id, proposedAt: later, message: null });
    await repository.decideChangeRequest({ interviewId: interview.id, decision: 'REJECTED', decidedBy: actorId, at: now });
    await expect(repository.decideChangeRequest({
      interviewId: interview.id, decision: 'APPROVED', decidedBy: actorId, at: now,
    })).rejects.toMatchObject({ code: 'CONCURRENT_CHANGE' });
    expect((await repository.getInterview(interview.id))?.scheduledAt).toEqual(scheduledAt);
  });

  it('DB09 rejects premature results without changing application or history', async () => {
    const { application, interview } = await invited();
    await expect(repository.recordInterviewResult({
      interviewId: interview.id, result: 'ACCEPTED', actorId, at: now,
    })).rejects.toMatchObject({ code: 'CONCURRENT_CHANGE' });
    expect((await repository.getApplication(application.id))?.status).toBe(S.INTERVIEW_SCHEDULED);
    expect((await repository.getInterview(interview.id))?.result).toBeNull();
    expect(await prisma.applicationStatusHistory.count({ where: { applicationId: application.id } })).toBe(3);
  });

  it('DB10 competing final results persist one consistent result and history', async () => {
    const { application, interview } = await invited();
    expectSingleWinner(await Promise.allSettled([
      repository.recordInterviewResult({ interviewId: interview.id, result: 'ACCEPTED', actorId, at: afterInterview }),
      repository.recordInterviewResult({ interviewId: interview.id, result: 'REJECTED', actorId, at: afterInterview, reason: 'Not selected' }),
    ]));
    const stored = await repository.getApplication(application.id);
    expect((await repository.getInterview(interview.id))?.result).toBe(stored?.status);
    const history = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: application.id, fromStatus: S.INTERVIEW_SCHEDULED },
    });
    expect(history).toHaveLength(1);
    expect(history[0].toStatus).toBe(stored?.status);
    if (stored?.status === S.REJECTED) {
      expect(stored.rejectionReason).toBe('Not selected');
      expect(history[0].reason).toBe('Not selected');
    }
  });
});
