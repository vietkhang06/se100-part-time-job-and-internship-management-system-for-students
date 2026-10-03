export const MAIL_SERVICE_TOKEN = Symbol('MAIL_SERVICE_TOKEN');

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
