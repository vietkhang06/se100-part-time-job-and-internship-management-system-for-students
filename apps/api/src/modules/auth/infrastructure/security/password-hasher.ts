import * as argon2 from 'argon2';

export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/,
  MESSAGE:
    'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
};

export class PasswordHasher {
  static async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
    });
  }

  static async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  static validatePolicy(password: string): boolean {
    return PASSWORD_POLICY.REGEX.test(password);
  }
}
