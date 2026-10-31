import { AuthErrorCode, UserRole, UserStatus } from './index';

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
});
