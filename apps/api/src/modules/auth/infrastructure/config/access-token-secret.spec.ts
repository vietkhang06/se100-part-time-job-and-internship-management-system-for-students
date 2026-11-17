import { ConfigService } from '@nestjs/config';
import { getAccessTokenSecret } from './access-token-secret';

describe('JWT_ACCESS_SECRET startup configuration', () => {
  it.each([undefined, '', 'short', 'replace_with_long_random_access_secret', ' '.repeat(40)])(
    'rejects invalid configuration without returning its value',
    (secret) => {
      const config = new ConfigService({ JWT_ACCESS_SECRET: secret });
      jest.spyOn(config, 'get').mockReturnValue(secret);

      expect(() => getAccessTokenSecret(config)).toThrow(
        /^JWT_ACCESS_SECRET must be configured with a non-placeholder secret of at least 32 bytes\.$/,
      );
    },
  );

  it('accepts a configured secret', () => {
    const secret = 'valid_test_only_value_with_at_least_32_bytes';
    expect(getAccessTokenSecret(new ConfigService({ JWT_ACCESS_SECRET: secret }))).toBe(secret);
  });
});
