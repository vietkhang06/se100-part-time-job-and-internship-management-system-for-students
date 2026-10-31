import { ApplicationStatus as S } from './application-state';
import {
  ApplicationSubmissionPolicyError,
  assertCanSubmitApplication,
  countActiveApplications,
  MAX_ACTIVE_APPLICATIONS_PER_STUDENT,
  PriorApplication,
} from './application-submission-policy';

const prior = (jobId: string, status: S): PriorApplication => ({ jobId, status });

describe('Application submission policy (M04-01/M04-02/S3-M04-03)', () => {
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

  describe('Active quota limit (S3-M04-03)', () => {
    it('allows up to 5 in-progress applications', () => {
      const fourActive: PriorApplication[] = [
        prior('job-1', S.SUBMITTED),
        prior('job-2', S.REVIEWING),
        prior('job-3', S.INTERVIEW_SCHEDULED),
        prior('job-4', S.SUBMITTED),
      ];
      expect(countActiveApplications(fourActive)).toBe(4);
      expect(() => assertCanSubmitApplication('job-5', fourActive)).not.toThrow();
    });

    it('rejects the 6th in-progress application with APPLICATION_QUOTA_EXCEEDED', () => {
      const fiveActive: PriorApplication[] = [
        prior('job-1', S.SUBMITTED),
        prior('job-2', S.REVIEWING),
        prior('job-3', S.INTERVIEW_SCHEDULED),
        prior('job-4', S.SUBMITTED),
        prior('job-5', S.REVIEWING),
      ];
      expect(countActiveApplications(fiveActive)).toBe(MAX_ACTIVE_APPLICATIONS_PER_STUDENT);
      expect(() => assertCanSubmitApplication('job-6', fiveActive)).toThrow(
        new ApplicationSubmissionPolicyError('APPLICATION_QUOTA_EXCEEDED'),
      );
    });

    it('does NOT count terminal states (ACCEPTED, REJECTED, WITHDRAWN) towards quota', () => {
      const mixedApplications: PriorApplication[] = [
        prior('job-1', S.SUBMITTED),
        prior('job-2', S.REVIEWING),
        prior('job-3', S.ACCEPTED),
        prior('job-4', S.REJECTED),
        prior('job-5', S.WITHDRAWN),
      ];
      expect(countActiveApplications(mixedApplications)).toBe(2);
      expect(() => assertCanSubmitApplication('job-6', mixedApplications)).not.toThrow();
    });

    it('allows submission when earlier application was withdrawn, freeing active slot', () => {
      const withWithdrawn: PriorApplication[] = [
        prior('job-1', S.SUBMITTED),
        prior('job-2', S.REVIEWING),
        prior('job-3', S.INTERVIEW_SCHEDULED),
        prior('job-4', S.SUBMITTED),
        prior('job-5', S.WITHDRAWN), // withdrawn does not count
      ];
      expect(countActiveApplications(withWithdrawn)).toBe(4);
      expect(() => assertCanSubmitApplication('job-6', withWithdrawn)).not.toThrow();
    });
  });
});

