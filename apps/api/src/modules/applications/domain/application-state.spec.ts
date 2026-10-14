import { UserRole } from '@campusjob/contracts';
import {
  ApplicationStatus as S,
  ApplicationAction,
  InvalidApplicationTransitionError,
  nextApplicationStatus,
} from './application-state';

describe('Application state rules (M04-01)', () => {
  it.each<[S, ApplicationAction, UserRole, S]>([
    [S.SUBMITTED, 'MARK_VIEWED', UserRole.EMPLOYER, S.REVIEWING],
    [S.SUBMITTED, 'WITHDRAW', UserRole.STUDENT, S.WITHDRAWN],
    [S.REVIEWING, 'WITHDRAW', UserRole.STUDENT, S.WITHDRAWN],
    [S.REVIEWING, 'REJECT', UserRole.EMPLOYER, S.REJECTED],
    [S.REVIEWING, 'SCHEDULE_INTERVIEW', UserRole.EMPLOYER, S.INTERVIEW_SCHEDULED],
    [S.INTERVIEW_SCHEDULED, 'ACCEPT_AFTER_INTERVIEW', UserRole.EMPLOYER, S.ACCEPTED],
    [S.INTERVIEW_SCHEDULED, 'REJECT_AFTER_INTERVIEW', UserRole.EMPLOYER, S.REJECTED],
  ])('%s + %s by %s becomes %s', (current, action, actor, expected) => {
    expect(nextApplicationStatus(current, action, actor)).toBe(expected);
  });

  it.each<[S, ApplicationAction, UserRole]>([
    [S.REVIEWING, 'MARK_VIEWED', UserRole.EMPLOYER],
    [S.INTERVIEW_SCHEDULED, 'WITHDRAW', UserRole.STUDENT],
    [S.SUBMITTED, 'REJECT', UserRole.EMPLOYER],
    [S.WITHDRAWN, 'SCHEDULE_INTERVIEW', UserRole.EMPLOYER],
    [S.ACCEPTED, 'REJECT_AFTER_INTERVIEW', UserRole.EMPLOYER],
    [S.REJECTED, 'WITHDRAW', UserRole.STUDENT],
    [S.REVIEWING, 'SCHEDULE_INTERVIEW', UserRole.STUDENT],
    [S.SUBMITTED, 'WITHDRAW', UserRole.EMPLOYER],
  ])('rejects %s + %s by %s', (current, action, actor) => {
    expect(() => nextApplicationStatus(current, action, actor)).toThrow(
      InvalidApplicationTransitionError,
    );
  });
});
