import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  INotificationEmailSender,
  NotificationEmailMessage,
} from '../../application/ports/notification-email-sender.port';

/**
 * Dùng cùng cấu hình SMTP (Mailpit khi dev) với MailModule nhưng ném lỗi khi thất bại,
 * vì NodemailerMailService.sendMail hiện nuốt lỗi nên không thể dùng để theo dõi PENDING/SENT/FAILED.
 */
@Injectable()
export class NodemailerNotificationEmailSender implements INotificationEmailSender {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(configService: ConfigService) {
    this.from = configService.get<string>('SMTP_FROM', 'no-reply@campusjob.local');
    this.transporter = nodemailer.createTransport({
      host: configService.get<string>('SMTP_HOST', 'localhost'),
      port: Number(configService.get<number>('SMTP_PORT', 1026)),
      secure: false,
      ignoreTLS: true,
    });
  }

  async send(message: NotificationEmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: `CampusJob — ${message.subject}`,
      text: message.text,
      html: message.html,
    });
  }
}
