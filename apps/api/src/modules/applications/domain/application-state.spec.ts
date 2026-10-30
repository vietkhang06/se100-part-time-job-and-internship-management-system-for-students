import { UserRole } from '@campusjob/contracts';
import {
  ApplicationStatus as S,
  ApplicationAction,
  APPLICATION_STATUS_LABELS,
  InvalidApplicationTransitionError,
  nextApplicationStatus,
  VIETNAMESE_LABEL_TO_STATUS,
} from './application-state';

describe('Application state rules (M04-01/S3-M04-04)', () => {
  it.each<[S, ApplicationAction, UserRole, S]>([
    [S.SUBMITTED, 'MARK_VIEWED', UserRole.EMPLOYER, S.REVIEWING],
    [S.SUBMITTED, 'WITHDRAW', UserRole.STUDENT, S.WITHDRAWN],
    [S.REVIEWING, 'WITHDRAW', UserRole.STUDENT, S.WITHDRAWN],
    [S.REVIEWING, 'REJECT', UserRole.EMPLOYER, S.REJECTED],
    [S.REVIEWING, 'SCHEDULE_INTERVIEW', UserRole.EMPLOYER, S.INTERVIEW_SCHEDULED],
    [S.INTERVIEW_SCHEDULED, 'ACCEPT_AFTER_INTERVIEW', UserRole.EMPLOYER, S.ACCEPTED],
    [S.INTERVIEW_SCHEDULED, 'REJECT_AFTER_INTERVIEW', UserRole.EMPLOYER, S.REJECTED],
  ])('%s + %s by %s becomes %s', (current, action, actor, expected) => {
    expect(nextApplicationStatus(current, action, actor, 'Standard reason')).toBe(expected);
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
    expect(() => nextApplicationStatus(current, action, actor, 'Some reason')).toThrow(
      InvalidApplicationTransitionError,
    );
  });

  describe('Rejection reason requirement (S3-M04-04)', () => {
    it('requires a reason when employer rejects from REVIEWING', () => {
      expect(() => nextApplicationStatus(S.REVIEWING, 'REJECT', UserRole.EMPLOYER, '')).toThrow(
        InvalidApplicationTransitionError,
      );
      expect(() => nextApplicationStatus(S.REVIEWING, 'REJECT', UserRole.EMPLOYER, '   ')).toThrow(
        InvalidApplicationTransitionError,
      );
      expect(nextApplicationStatus(S.REVIEWING, 'REJECT', UserRole.EMPLOYER, 'Not qualified')).toBe(
        S.REJECTED,
      );
    });

    it('requires a reason when employer rejects after interview', () => {
      expect(() =>
        nextApplicationStatus(S.INTERVIEW_SCHEDULED, 'REJECT_AFTER_INTERVIEW', UserRole.EMPLOYER, ''),
      ).toThrow(InvalidApplicationTransitionError);
      expect(
        nextApplicationStatus(
          S.INTERVIEW_SCHEDULED,
          'REJECT_AFTER_INTERVIEW',
          UserRole.EMPLOYER,
          'Interview failed',
        ),
      ).toBe(S.REJECTED);
    });
  });

  describe('Vietnamese label mapping (S3-M04-04)', () => {
    it('correctly maps enum values to official Vietnamese labels', () => {
      expect(APPLICATION_STATUS_LABELS[S.SUBMITTED]).toBe('Đã nộp');
      expect(APPLICATION_STATUS_LABELS[S.REVIEWING]).toBe('Đã xem');
      expect(APPLICATION_STATUS_LABELS[S.INTERVIEW_SCHEDULED]).toBe('Hẹn phỏng vấn');
      expect(APPLICATION_STATUS_LABELS[S.ACCEPTED]).toBe('Trúng tuyển');
      expect(APPLICATION_STATUS_LABELS[S.REJECTED]).toBe('Không trúng tuyển');
      expect(APPLICATION_STATUS_LABELS[S.WITHDRAWN]).toBe('Đã rút hồ sơ');
    });

    it('correctly maps Vietnamese labels back to enum values', () => {
      expect(VIETNAMESE_LABEL_TO_STATUS['Đã xem']).toBe(S.REVIEWING);
      expect(VIETNAMESE_LABEL_TO_STATUS['Hẹn phỏng vấn']).toBe(S.INTERVIEW_SCHEDULED);
      expect(VIETNAMESE_LABEL_TO_STATUS['Từ chối']).toBe(S.REJECTED);
      expect(VIETNAMESE_LABEL_TO_STATUS['Không trúng tuyển']).toBe(S.REJECTED);
      expect(VIETNAMESE_LABEL_TO_STATUS['Trúng tuyển']).toBe(S.ACCEPTED);
      expect(VIETNAMESE_LABEL_TO_STATUS['Rút hồ sơ']).toBe(S.WITHDRAWN);
      expect(VIETNAMESE_LABEL_TO_STATUS['Đã rút hồ sơ']).toBe(S.WITHDRAWN);
    });
  });
});

