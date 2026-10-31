import { JwtService } from '@nestjs/jwt';
import { parseJwtExpiration } from './auth.module';

describe('parseJwtExpiration', () => {
  const jwt = new JwtService();

  const expirationOffset = (value: string): number => {
    const token = jwt.sign(
      { iat: 100 },
      {
        secret: 'jwt-duration-test-only',
        expiresIn: parseJwtExpiration(value),
      },
    );
    const payload = jwt.decode<{ iat: number; exp: number }>(token);
    return payload.exp - payload.iat;
  };

  it('keeps the default 15 minute duration behavior', () => {
    expect(expirationOffset('15m')).toBe(15 * 60);
  });

  it('preserves a bare numeric string duration as milliseconds', () => {
    expect(expirationOffset('3600')).toBe(3);
  });

  it('accepts duration units supported by the installed JWT duration parser', () => {
    expect(expirationOffset('30sec')).toBe(30);
  });

  it('rejects a missing value', () => {
    expect(() => parseJwtExpiration(undefined)).toThrow(/non-empty duration string/);
  });

  it('rejects a blank value', () => {
    expect(() => parseJwtExpiration('   ')).toThrow(/non-empty duration string/);
  });

  it('rejects an invalid duration', () => {
    expect(() => parseJwtExpiration('not-a-duration')).toThrow(/valid duration string/);
  });

  it('allows zero and produces an immediately expiring token', () => {
    expect(expirationOffset('0')).toBe(0);
  });

  it('allows negative durations according to jsonwebtoken and produces an expired token', () => {
    expect(expirationOffset('-1s')).toBe(-1);
  });
});
