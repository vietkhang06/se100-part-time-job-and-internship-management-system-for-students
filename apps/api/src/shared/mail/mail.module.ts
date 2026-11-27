import { Module } from '@nestjs/common';
import {
  CAMPUS_VERIFICATION_MAILER_TOKEN,
  MAIL_SERVICE_TOKEN,
} from './mail.service.interface';
import { NodemailerMailService } from './nodemailer-mail.service';

@Module({
  providers: [
    NodemailerMailService,
    {
      provide: MAIL_SERVICE_TOKEN,
      useExisting: NodemailerMailService,
    },
    {
      provide: CAMPUS_VERIFICATION_MAILER_TOKEN,
      useExisting: NodemailerMailService,
    },
  ],
  exports: [MAIL_SERVICE_TOKEN, CAMPUS_VERIFICATION_MAILER_TOKEN],
})
export class MailModule {}
