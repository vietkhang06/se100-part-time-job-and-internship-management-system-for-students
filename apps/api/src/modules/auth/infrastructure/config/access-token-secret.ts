import { ConfigService } from '@nestjs/config';

export function getAccessTokenSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_ACCESS_SECRET');
  if (
    !secret ||
    secret !== secret.trim() ||
    Buffer.byteLength(secret, 'utf8') < 32 ||
    secret === 'replace_with_long_random_access_secret'
  ) {
    throw new Error('JWT_ACCESS_SECRET must be configured with a non-placeholder secret of at least 32 bytes.');
  }

  return secret;
}
