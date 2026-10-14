import { ApplicationStatus } from '../../applications/domain/application-state';
import {
  assertCanDecideReschedule,
  assertCanRecordInterviewResult,
  assertCanRequestReschedule,
  assertValidInterviewSchedule,
  InvalidInterviewActionError,
} from './interview-rules';

const now = new Date('2026-10-14T10:00:00.000Z');
const future = new Date('2026-10-15T10:00:00.000Z');
const later = new Date('2026-10-16T10:00:00.000Z');
const past = new Date('2026-10-13T10:00:00.000Z');

describe('Interview rules (M04-05)', () => {
  it('requires a future schedule and a usable location or online link', () => {
    expect(() => assertValidInterviewSchedule(future, 'ONSITE', 'Room A', now)).not.toThrow();
    expect(() => assertValidInterviewSchedule(future, 'ONLINE', 'https://example.org/meet', now)).not.toThrow();
    expect(() => assertValidInterviewSchedule(past, 'ONSITE', 'Room A', now)).toThrow(InvalidInterviewActionError);
    expect(() => assertValidInterviewSchedule(future, 'ONLINE', ' ', now)).toThrow(InvalidInterviewActionError);
    expect(() => assertValidInterviewSchedule(future, 'ONSITE', ' ', now)).toThrow(InvalidInterviewActionError);
  });

  it('allows one change request before the interview, with a future proposed time', () => {
    expect(() => assertCanRequestReschedule(0, future, later, now)).not.toThrow();
    expect(() => assertCanRequestReschedule(1, future, later, now)).toThrow(InvalidInterviewActionError);
    expect(() => assertCanRequestReschedule(0, past, later, now)).toThrow(InvalidInterviewActionError);
    expect(() => assertCanRequestReschedule(0, future, past, now)).toThrow(InvalidInterviewActionError);
  });

  it('prevents a reschedule request from being decided twice', () => {
    expect(() => assertCanDecideReschedule('PENDING')).not.toThrow();
    expect(() => assertCanDecideReschedule('APPROVED')).toThrow(InvalidInterviewActionError);
    expect(() => assertCanDecideReschedule('REJECTED')).toThrow(InvalidInterviewActionError);
  });

  it('allows a result only after a scheduled interview has occurred', () => {
    expect(() => assertCanRecordInterviewResult(ApplicationStatus.INTERVIEW_SCHEDULED, past, now)).not.toThrow();
    expect(() => assertCanRecordInterviewResult(ApplicationStatus.INTERVIEW_SCHEDULED, future, now)).toThrow(InvalidInterviewActionError);
    expect(() => assertCanRecordInterviewResult(ApplicationStatus.WITHDRAWN, past, now)).toThrow(InvalidInterviewActionError);
    expect(() => assertCanRecordInterviewResult(ApplicationStatus.ACCEPTED, past, now)).toThrow(InvalidInterviewActionError);
  });
});
