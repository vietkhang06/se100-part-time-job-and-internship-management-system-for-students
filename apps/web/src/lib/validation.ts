export const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: `Ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
    test: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  { id: 'lower', label: 'Có chữ thường (a-z)', test: (value: string) => /[a-z]/.test(value) },
  { id: 'upper', label: 'Có chữ hoa (A-Z)', test: (value: string) => /[A-Z]/.test(value) },
  { id: 'digit', label: 'Có chữ số (0-9)', test: (value: string) => /\d/.test(value) },
  {
    id: 'special',
    label: 'Có ký tự đặc biệt (ví dụ: ! @ # $ %)',
    test: (value: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value),
  },
] as const;

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return 'Vui lòng nhập email.';
  if (!EMAIL_REGEX.test(email)) return 'Email không hợp lệ.';
  return undefined;
}

export function validateNewPassword(value: string): string | undefined {
  if (!value) return 'Vui lòng nhập mật khẩu mới.';
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(value));
  if (failed.length > 0) {
    return 'Mật khẩu chưa đáp ứng đủ yêu cầu bên dưới.';
  }
  return undefined;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | undefined {
  if (!confirmation) return 'Vui lòng nhập lại mật khẩu mới.';
  if (password !== confirmation) return 'Mật khẩu xác nhận không khớp.';
  return undefined;
}