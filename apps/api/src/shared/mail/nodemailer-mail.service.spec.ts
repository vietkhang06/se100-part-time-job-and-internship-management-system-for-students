import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NodemailerMailService } from './nodemailer-mail.service';

jest.mock('nodemailer');

describe('NodemailerMailService - Campus OTP Delivery (COND-M02-01)', () => {
  const sendMailMock = jest.fn();

  beforeEach(() => {
    sendMailMock.mockReset();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });
  });

  it('sends campus verification OTP email with configured SMTP settings', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'msg-1' });
    const config = new ConfigService({
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1026,
      SMTP_FROM: 'no-reply@campusjob.local',
    });

    const service = new NodemailerMailService(config);
    await service.sendCampusVerificationOtpEmail(
      '21520001@gm.uit.edu.vn',
      '123456',
      10,
    );

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '21520001@gm.uit.edu.vn',
        subject: expect.stringContaining('OTP'),
        html: expect.stringContaining('123456'),
        text: expect.stringContaining('123456'),
      }),
    );
  });

  it('rethrows SMTP transport error when campus OTP email fails so caller can rollback', async () => {
    sendMailMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const config = new ConfigService({
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1026,
    });

    const service = new NodemailerMailService(config);

    await expect(
      service.sendCampusVerificationOtpEmail(
        '21520001@gm.uit.edu.vn',
        '123456',
        10,
      ),
    ).rejects.toThrow('ECONNREFUSED');
  });
});

