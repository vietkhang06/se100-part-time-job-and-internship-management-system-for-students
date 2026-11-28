import {
  generateNumericOtp,
  hashCampusOtp,
  isAllowedCampusEmail,
  normalizeCampusEmail,
  verifyCampusOtpHash,
} from './campus-email-policy';

describe('CampusEmailPolicy (COND-M02-01)', () => {
  describe('isAllowedCampusEmail', () => {
    it('accepts valid Vietnamese university .edu.vn emails by default', () => {
      expect(isAllowedCampusEmail('21520001@gm.uit.edu.vn')).toBe(true);
      expect(isAllowedCampusEmail('  Student.A@HUST.EDU.VN  ')).toBe(true);
      expect(isAllowedCampusEmail('sv@fit.hcmus.edu.vn')).toBe(true);
    });

    it('rejects consumer, spoofing, bare-suffix, and malformed email addresses', () => {
      expect(isAllowedCampusEmail('student@gmail.com')).toBe(false);
      expect(isAllowedCampusEmail('student@edu.vn')).toBe(false);
      expect(isAllowedCampusEmail('student@uit.edu.vn.attacker.com')).toBe(false);
      expect(isAllowedCampusEmail('student@myedu.vn')).toBe(false);
      expect(isAllowedCampusEmail('student@.edu.vn')).toBe(false);
      expect(isAllowedCampusEmail('not-an-email')).toBe(false);
      expect(isAllowedCampusEmail('')).toBe(false);
    });

    it('supports additional configured domains and suffixes', () => {
      expect(
        isAllowedCampusEmail('student@mit.edu', {
          allowedSuffixes: ['.edu.vn', '.edu'],
        }),
      ).toBe(true);
      expect(
        isAllowedCampusEmail('student@custom-uni.vn', {
          allowedDomains: ['custom-uni.vn'],
        }),
      ).toBe(true);
    });
  });

  describe('normalizeCampusEmail & OTP hashing', () => {
    it('normalizes whitespace and case', () => {
      expect(normalizeCampusEmail('  21520001@GM.UIT.EDU.VN ')).toBe(
        '21520001@gm.uit.edu.vn',
      );
    });

    it('generates 6-digit numeric OTP and verifies constant-time HMAC hash bound to profile & email', () => {
      const otp = generateNumericOtp();
      expect(otp).toMatch(/^\d{6}$/);

      const expectedHash = hashCampusOtp({
        studentProfileId: 'profile-1',
        campusEmail: '21520001@gm.uit.edu.vn',
        otp,
        secret: 'test-secret',
      });

      expect(
        verifyCampusOtpHash({
          studentProfileId: 'profile-1',
          campusEmail: '21520001@GM.UIT.EDU.VN',
          otp,
          expectedHash,
          secret: 'test-secret',
        }),
      ).toBe(true);

      // Bound to email and profileId: cross-email or cross-profile fails
      expect(
        verifyCampusOtpHash({
          studentProfileId: 'profile-2',
          campusEmail: '21520001@gm.uit.edu.vn',
          otp,
          expectedHash,
          secret: 'test-secret',
        }),
      ).toBe(false);
      expect(
        verifyCampusOtpHash({
          studentProfileId: 'profile-1',
          campusEmail: 'other@gm.uit.edu.vn',
          otp,
          expectedHash,
          secret: 'test-secret',
        }),
      ).toBe(false);
      expect(
        verifyCampusOtpHash({
          studentProfileId: 'profile-1',
          campusEmail: '21520001@gm.uit.edu.vn',
          otp: otp === '000000' ? '000001' : '000000',
          expectedHash,
          secret: 'test-secret',
        }),
      ).toBe(false);
    });
  });
});

