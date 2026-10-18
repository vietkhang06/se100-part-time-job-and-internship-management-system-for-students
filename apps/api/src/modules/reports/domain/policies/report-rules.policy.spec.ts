import { UserRole, ViolationTargetType as T } from '@campusjob/contracts';
import { buildOpenKey, canReportTarget } from './report-rules.policy';

describe('report-rules.policy', () => {
  it('lets students report company, job and review but not students', () => {
    expect(canReportTarget(UserRole.STUDENT, T.COMPANY)).toBe(true);
    expect(canReportTarget(UserRole.STUDENT, T.JOB)).toBe(true);
    expect(canReportTarget(UserRole.STUDENT, T.REVIEW)).toBe(true);
    expect(canReportTarget(UserRole.STUDENT, T.STUDENT)).toBe(false);
  });

  it('lets employers report students and reviews but not companies or jobs', () => {
    expect(canReportTarget(UserRole.EMPLOYER, T.STUDENT)).toBe(true);
    expect(canReportTarget(UserRole.EMPLOYER, T.REVIEW)).toBe(true);
    expect(canReportTarget(UserRole.EMPLOYER, T.COMPANY)).toBe(false);
    expect(canReportTarget(UserRole.EMPLOYER, T.JOB)).toBe(false);
  });

  it('does not let moderators or admins file reports', () => {
    expect(canReportTarget(UserRole.MODERATOR, T.JOB)).toBe(false);
    expect(canReportTarget(UserRole.ADMIN, T.COMPANY)).toBe(false);
  });

  it('builds a stable open key', () => {
    expect(buildOpenKey('u1', T.JOB, 'j1')).toBe('u1:JOB:j1');
  });
});
