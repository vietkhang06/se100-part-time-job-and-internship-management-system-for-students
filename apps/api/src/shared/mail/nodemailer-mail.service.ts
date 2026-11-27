import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  ICampusVerificationMailer,
  IMailService,
  SendMailOptions,
} from './mail.service.interface';

@Injectable()
export class NodemailerMailService
  implements IMailService, ICampusVerificationMailer
{
  private readonly logger = new Logger(NodemailerMailService.name);
  private transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly webUrl: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST', 'localhost');
    const port = Number(this.configService.get<number>('SMTP_PORT', 1026));
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const auth = user && pass ? { user, pass } : undefined;

    this.from = this.configService.get<string>('SMTP_FROM', 'no-reply@campusjob.local');
    this.webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      ignoreTLS: this.configService.get<string>('SMTP_IGNORE_TLS') !== 'false',
      auth,
    });
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      this.logger.log(`Email '${options.subject}' dispatched successfully to ${options.to}`);
    } catch (err: unknown) {
      this.logger.error(`Failed to dispatch email to ${options.to}: ${err instanceof Error ? err.message : String(err)}`);
      // Do not rethrow in a way that exposes SMTP secrets or fails critical transactional state if mail transport is offline
      // But log the error clearly.
    }
  }

  async sendVerificationEmail(to: string, rawToken: string): Promise<void> {
    const verificationUrl = `${this.webUrl}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(to)}`;
    const subject = 'CampusJob — Xác thực địa chỉ email tài khoản';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; rounded: 8px;">
        <h2 style="color: #2563eb;">Chào mừng bạn đến với CampusJob!</h2>
        <p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng nhấn vào liên kết bên dưới để xác minh địa chỉ email của bạn:</p>
        <p style="margin: 25px 0;">
          <a href="${verificationUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Xác minh Email ngay
          </a>
        </p>
        <p style="font-size: 13px; color: #666;">Liên kết này có hiệu lực trong vòng <strong>24 giờ</strong> và chỉ sử dụng được 1 lần duy nhất.</p>
        <p style="font-size: 12px; color: #999;">Nếu bạn không thực hiện đăng ký tài khoản tại CampusJob, vui lòng bỏ qua email này.</p>
      </div>
    `;

    await this.sendMail({
      to,
      subject,
      html,
      text: `Xác thực email của bạn tại CampusJob bằng liên kết sau (hiệu lực 24h): ${verificationUrl}`,
    });
  }

  async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
    const resetUrl = `${this.webUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const subject = 'CampusJob — Yêu cầu đặt lại mật khẩu';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; rounded: 8px;">
        <h2 style="color: #2563eb;">Yêu cầu đặt lại mật khẩu</h2>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản CampusJob của bạn.</p>
        <p style="margin: 25px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Đặt lại mật khẩu
          </a>
        </p>
        <p style="font-size: 13px; color: #666;">Liên kết này có hiệu lực trong vòng <strong>1 giờ</strong> và chỉ sử dụng được 1 lần duy nhất.</p>
        <p style="font-size: 12px; color: #999;">Nếu bạn không yêu cầu đặt lại mật khẩu, tài khoản của bạn vẫn an toàn và bạn có thể yên tâm bỏ qua email này.</p>
      </div>
    `;

    await this.sendMail({
      to,
      subject,
      html,
      text: `Đặt lại mật khẩu CampusJob của bạn bằng liên kết sau (hiệu lực 1h): ${resetUrl}`,
    });
  }

  async sendCampusVerificationOtpEmail(
    to: string,
    otpCode: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const subject = 'CampusJob — Mã OTP xác thực email sinh viên';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb;">Xác thực email trường đại học</h2>
        <p>Bạn vừa yêu cầu xác thực địa chỉ email sinh viên trên CampusJob. Vui lòng nhập mã OTP bên dưới vào trang Hồ sơ cá nhân:</p>
        <div style="margin: 24px 0; padding: 16px; background-color: #f3f4f6; border-radius: 8px; text-align: center;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #111827;">${otpCode}</span>
        </div>
        <p style="font-size: 13px; color: #666;">Mã OTP có hiệu lực trong vòng <strong>${expiresInMinutes} phút</strong> và chỉ sử dụng được <strong>1 lần duy nhất</strong>.</p>
        <p style="font-size: 12px; color: #999;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
        text: `Ma OTP xac thuc email sinh vien CampusJob cua ban la ${otpCode}. Ma co hieu luc trong ${expiresInMinutes} phut va chi dung 1 lan.`,
      });
      this.logger.log(`Campus verification OTP email dispatched successfully to ${to}`);
    } catch (err: unknown) {
      this.logger.error(
        `Failed to dispatch campus verification OTP email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
