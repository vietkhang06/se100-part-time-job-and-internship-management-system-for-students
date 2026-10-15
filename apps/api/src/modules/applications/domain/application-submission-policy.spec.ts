import { ApplicationStatus as S } from './application-state';
import {
  ApplicationSubmissionPolicyError,
  assertCanSubmitApplication,
  PriorApplication,
} from './application-submission-policy';

const prior = (jobId: string, status: S): PriorApplication => ({ jobId, status });

describe('Application submission policy (M04-01/M04-02)', () => {
  it('allows a first application for a job', () => {
    expect(() => assertCanSubmitApplication('new', [prior('another', S.SUBMITTED)])).not.toThrow();
  });

  it.each([S.SUBMITTED, S.REVIEWING, S.INTERVIEW_SCHEDULED, S.ACCEPTED, S.REJECTED, S.WITHDRAWN])(
    'rejects another application for the same job after %s',
    (status) => {
      expect(() => assertCanSubmitApplication('job-1', [prior('job-1', status)])).toThrow(
        new ApplicationSubmissionPolicyError('APPLICATION_ALREADY_EXISTS_FOR_JOB'),
      );
    },
  );
});
