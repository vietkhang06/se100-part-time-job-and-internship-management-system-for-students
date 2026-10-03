import { Module } from '@nestjs/common';
import { MAIL_SERVICE_TOKEN } from './mail.service.interface';
import { NodemailerMailService } from './nodemailer-mail.service';

@Module({
  providers: [
    {
      provide: MAIL_SERVICE_TOKEN,
      useClass: NodemailerMailService,
    },
  ],
  exports: [MAIL_SERVICE_TOKEN],
})
export class MailModule {}
