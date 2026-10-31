import {
  validateEmail,
  validateNewPassword,
  validatePasswordConfirmation,
} from './validation';

describe('form validation', () => {
  it('trims email input and rejects malformed addresses', () => {
    expect(validateEmail('  student@example.com  ')).toBeUndefined();
    expect(validateEmail('not-an-email')).toBe('Email không hợp lệ.');
  });

  it('requires every password rule', () => {
    expect(validateNewPassword('Password1!')).toBeUndefined();
    expect(validateNewPassword('password')).toBe('Mật khẩu chưa đáp ứng đủ yêu cầu bên dưới.');
  });

  it('checks that confirmation matches the password', () => {
    expect(validatePasswordConfirmation('Password1!', 'Password1!')).toBeUndefined();
    expect(validatePasswordConfirmation('Password1!', 'Password2!')).toBe(
      'Mật khẩu xác nhận không khớp.',
    );
  });
});
