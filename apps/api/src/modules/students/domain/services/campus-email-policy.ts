import * as crypto from 'crypto';

export const CAMPUS_OTP_LENGTH = 6;
export const CAMPUS_OTP_TTL_MINUTES = 10;
export const CAMPUS_OTP_TTL_MS = CAMPUS_OTP_TTL_MINUTES * 60 * 1000;
export const CAMPUS_OTP_COOLDOWN_SECONDS = 60;
export const CAMPUS_OTP_COOLDOWN_MS = CAMPUS_OTP_COOLDOWN_SECONDS * 1000;
export const CAMPUS_OTP_MAX_REQUESTS_PER_HOUR = 5;
export const CAMPUS_OTP_MAX_ATTEMPTS = 5;
export const DEFAULT_CAMPUS_EMAIL_ALLOWED_SUFFIXES = ['.edu.vn'] as const;

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DEFAULT_OTP_HMAC_PEPPER = 'campusjob-campus-otp-v1';

export interface CampusDomainPolicyOptions {
  allowedSuffixes?: readonly string[];
  allowedDomains?: readonly string[];
}

export function normalizeCampusEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseCsvPolicyList(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isValidDomainName(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  return labels.every((label) => DOMAIN_LABEL_REGEX.test(label));
}

export function isAllowedCampusEmail(
  rawEmail: string,
  options?: CampusDomainPolicyOptions,
): boolean {
  const normalized = normalizeCampusEmail(rawEmail);
  if (!normalized || normalized.length > 254 || !EMAIL_FORMAT_REGEX.test(normalized)) {
    return false;
  }

  const parts = normalized.split('@');
  if (parts.length !== 2) return false;
  const [localPart, domain] = parts;
  if (!localPart || localPart.length > 64 || !isValidDomainName(domain)) {
    return false;
  }

  const allowedDomains = (options?.allowedDomains ?? [])
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (allowedDomains.includes(domain)) {
    return true;
  }

  const suffixes =
    options?.allowedSuffixes && options.allowedSuffixes.length > 0
      ? options.allowedSuffixes
      : DEFAULT_CAMPUS_EMAIL_ALLOWED_SUFFIXES;

  return suffixes.some((rawSuffix) => {
    const suffix = rawSuffix.trim().toLowerCase();
    if (!suffix) return false;
    const dotSuffix = suffix.startsWith('.') ? suffix : `.${suffix}`;
    return domain.endsWith(dotSuffix) && domain.length > dotSuffix.length;
  });
}

export function generateNumericOtp(length: number = CAMPUS_OTP_LENGTH): string {
  const max = Math.pow(10, length);
  return crypto.randomInt(0, max).toString().padStart(length, '0');
}

export function hashCampusOtp(params: {
  studentProfileId: string;
  campusEmail: string;
  otp: string;
  secret?: string;
}): string {
  const pepper = params.secret?.trim() || DEFAULT_OTP_HMAC_PEPPER;
  const payload = `${params.studentProfileId}:${normalizeCampusEmail(params.campusEmail)}:${params.otp.trim()}`;
  return crypto.createHmac('sha256', pepper).update(payload).digest('hex');
}

export function verifyCampusOtpHash(params: {
  studentProfileId: string;
  campusEmail: string;
  otp: string;
  expectedHash: string;
  secret?: string;
}): boolean {
  const candidateHash = hashCampusOtp({
    studentProfileId: params.studentProfileId,
    campusEmail: params.campusEmail,
    otp: params.otp,
    secret: params.secret,
  });

  const candidateBuf = Buffer.from(candidateHash, 'hex');
  const expectedBuf = Buffer.from(params.expectedHash, 'hex');
  if (candidateBuf.length !== expectedBuf.length || candidateBuf.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}

