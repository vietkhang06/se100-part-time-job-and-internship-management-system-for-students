import { AuthErrorCode, StudentProfileErrorCode, UserRole, UserStatus } from './index';

describe('shared contract enums', () => {
  it('provides stable wire values for roles and user states', () => {
    expect(UserRole.STUDENT).toBe('STUDENT');
    expect(UserRole.MODERATOR).toBe('MODERATOR');
    expect(UserStatus.PENDING_VERIFICATION).toBe('PENDING_VERIFICATION');
    expect(UserStatus.ACTIVE).toBe('ACTIVE');
  });

  it('provides stable authentication error codes', () => {
    expect(AuthErrorCode.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
    expect(AuthErrorCode.REFRESH_TOKEN_REUSED).toBe('REFRESH_TOKEN_REUSED');
  });

  it('provides stable student campus verification error codes', () => {
    expect(StudentProfileErrorCode.CAMPUS_EMAIL_DOMAIN_NOT_ALLOWED).toBe('CAMPUS_EMAIL_DOMAIN_NOT_ALLOWED');
    expect(StudentProfileErrorCode.CAMPUS_EMAIL_ALREADY_IN_USE).toBe('CAMPUS_EMAIL_ALREADY_IN_USE');
    expect(StudentProfileErrorCode.CAMPUS_OTP_INVALID).toBe('CAMPUS_OTP_INVALID');
    expect(StudentProfileErrorCode.CAMPUS_OTP_EXPIRED).toBe('CAMPUS_OTP_EXPIRED');
    expect(StudentProfileErrorCode.CAMPUS_OTP_RATE_LIMITED).toBe('CAMPUS_OTP_RATE_LIMITED');
  });
});
