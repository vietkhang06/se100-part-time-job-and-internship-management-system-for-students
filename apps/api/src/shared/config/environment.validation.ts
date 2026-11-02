const JWT_ACCESS_SECRET_PLACEHOLDER = 'replace_with_long_random_access_secret';

const REQUIRED_ENVIRONMENT_VARIABLES = ['DATABASE_URL', 'JWT_ACCESS_SECRET'] as const;

/** Validates application configuration without including configuration values in errors. */
export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const invalidVariables: string[] = [];

  for (const name of REQUIRED_ENVIRONMENT_VARIABLES) {
    const value = config[name];
    if (typeof value !== 'string' || value.trim().length === 0) {
      invalidVariables.push(name);
    }
  }

  const accessSecret = config.JWT_ACCESS_SECRET;
  if (
    typeof accessSecret === 'string' &&
    accessSecret.trim().length > 0 &&
    accessSecret === JWT_ACCESS_SECRET_PLACEHOLDER
  ) {
    invalidVariables.push('JWT_ACCESS_SECRET');
  }

  const databaseUrl = config.DATABASE_URL;
  if (typeof databaseUrl === 'string' && databaseUrl.trim().length > 0) {
    try {
      const parsed = new URL(databaseUrl);
      if (
        !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
        parsed.hostname.length === 0
      ) {
        invalidVariables.push('DATABASE_URL');
      }
    } catch {
      invalidVariables.push('DATABASE_URL');
    }
  }

  const refreshTtlDays = config.REFRESH_TOKEN_TTL_DAYS;
  if (refreshTtlDays !== undefined) {
    const parsedTtlDays =
      typeof refreshTtlDays === 'string' && /^\d+$/.test(refreshTtlDays)
        ? Number(refreshTtlDays)
        : Number.NaN;
    if (!Number.isSafeInteger(parsedTtlDays) || parsedTtlDays <= 0) {
      invalidVariables.push('REFRESH_TOKEN_TTL_DAYS');
    }
  }

  const cookieSecure = config.COOKIE_SECURE;
  if (cookieSecure !== undefined && cookieSecure !== 'true' && cookieSecure !== 'false') {
    invalidVariables.push('COOKIE_SECURE');
  }
  if (config.NODE_ENV === 'production' && cookieSecure !== 'true') {
    invalidVariables.push('COOKIE_SECURE');
  }

  if (invalidVariables.length > 0) {
    const names = [...new Set(invalidVariables)];
    throw new Error(`Invalid environment configuration: ${names.join(', ')}`);
  }

  return config;
}
