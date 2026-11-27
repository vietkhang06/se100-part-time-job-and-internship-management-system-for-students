export const MAIL_SERVICE_TOKEN = Symbol('MAIL_SERVICE_TOKEN');
export const CAMPUS_VERIFICATION_MAILER_TOKEN = Symbol(
  'CAMPUS_VERIFICATION_MAILER_TOKEN',
);

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface IMailService {
  sendMail(options: SendMailOptions): Promise<void>;
  sendVerificationEmail(to: string, rawToken: string): Promise<void>;
  sendPasswordResetEmail(to: string, rawToken: string): Promise<void>;
}

export interface ICampusVerificationMailer {
  sendCampusVerificationOtpEmail(
    to: string,
    otpCode: string,
    expiresInMinutes: number,
  ): Promise<void>;
}
