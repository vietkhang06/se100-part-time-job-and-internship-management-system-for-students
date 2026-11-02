import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IJobExpiryNotifier,
  JobExpiryReminderData,
} from '../../domain/ports/job-expiry-notifier.port';
import {
  IMailService,
  MAIL_SERVICE_TOKEN,
} from '../../../../shared/mail/mail.service.interface';

@Injectable()
export class JobExpiryEmailNotifierAdapter implements IJobExpiryNotifier {
  private readonly logger = new Logger(JobExpiryEmailNotifierAdapter.name);

  constructor(
    @Inject(MAIL_SERVICE_TOKEN)
    private readonly mailService: IMailService,
  ) {}

  async sendExpiryReminder(data: JobExpiryReminderData): Promise<void> {
    const formattedDeadline = data.deadline.toISOString().slice(0, 10);

    const subject = `[Nhắc nhở] Tin tuyển dụng "${data.jobTitle}" sẽ hết hạn sau ${data.daysRemaining} ngày`;
    const html = `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <h2>Kính gửi ${data.recipientName},</h2>
        <p>Tin tuyển dụng <strong>${data.jobTitle}</strong> của doanh nghiệp <strong>${data.companyName}</strong> sắp hết hạn nhận hồ sơ.</p>
        <p><strong>Hạn nộp hồ sơ:</strong> ${formattedDeadline} (còn ${data.daysRemaining} ngày).</p>
        <p>Sau thời hạn này, tin tuyển dụng sẽ tự động chuyển sang trạng thái <strong>Đã đóng</strong> và không còn nhận đơn ứng tuyển mới.</p>
        <p>Trân trọng,<br/>Đội ngũ Hỗ trợ CampusJob</p>
      </div>
    `;

    await this.mailService.sendMail({
      to: data.recipientEmail,
      subject,
      html,
    });
  }
}
