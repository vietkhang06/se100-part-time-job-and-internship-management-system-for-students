import { BadRequestException } from '@nestjs/common';
import { NotificationEventType } from '@campusjob/contracts';
import { GetNotificationEmailPreferencesUseCase } from './get-notification-email-preferences.use-case';
import { UpdateNotificationEmailPreferenceUseCase } from './update-notification-email-preference.use-case';
import { INotificationPreferenceRepository } from '../../domain/repositories/notification-preference.repository.interface';
import { NotificationEmailPreferenceEntity } from '../../domain/entities/notification-email-preference.entity';

describe('NotificationEmailPreferencesUseCases', () => {
  let repo: jest.Mocked<INotificationPreferenceRepository>;
  let getUseCase: GetNotificationEmailPreferencesUseCase;
  let updateUseCase: UpdateNotificationEmailPreferenceUseCase;

  beforeEach(() => {
    repo = {
      findByUser: jest.fn(),
      findByUserAndEvent: jest.fn(),
      upsert: jest.fn(),
      isEmailEnabled: jest.fn(),
    };
    getUseCase = new GetNotificationEmailPreferencesUseCase(repo);
    updateUseCase = new UpdateNotificationEmailPreferenceUseCase(repo);
  });

  describe('GetNotificationEmailPreferencesUseCase', () => {
    it('returns default true for all email-capable events when user has no stored preferences', async () => {
      repo.findByUser.mockResolvedValue([]);
      const result = await getUseCase.execute('user-1');

      expect(result.length).toBe(11);
      for (const pref of result) {
        expect(pref.emailEnabled).toBe(true);
      }
      expect(repo.findByUser).toHaveBeenCalledWith('user-1');
    });

    it('merges stored preferences with defaults', async () => {
      repo.findByUser.mockResolvedValue([
        new NotificationEmailPreferenceEntity({
          id: 'p-1',
          userId: 'user-1',
          eventType: NotificationEventType.JOB_APPROVED,
          emailEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ]);

      const result = await getUseCase.execute('user-1');
      const jobApprovedPref = result.find(
        (p) => p.eventType === NotificationEventType.JOB_APPROVED,
      );
      const interviewInvitedPref = result.find(
        (p) => p.eventType === NotificationEventType.INTERVIEW_INVITED,
      );

      expect(jobApprovedPref?.emailEnabled).toBe(false);
      expect(interviewInvitedPref?.emailEnabled).toBe(true);
    });
  });

  describe('UpdateNotificationEmailPreferenceUseCase', () => {
    it('updates preference for a valid email-capable event type', async () => {
      repo.upsert.mockResolvedValue(
        new NotificationEmailPreferenceEntity({
          id: 'p-1',
          userId: 'user-1',
          eventType: NotificationEventType.JOB_APPROVED,
          emailEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const result = await updateUseCase.execute('user-1', {
        eventType: NotificationEventType.JOB_APPROVED,
        emailEnabled: false,
      });

      expect(result).toEqual({
        eventType: NotificationEventType.JOB_APPROVED,
        emailEnabled: false,
      });
      expect(repo.upsert).toHaveBeenCalledWith(
        'user-1',
        NotificationEventType.JOB_APPROVED,
        false,
      );
    });

    it('throws BadRequestException when event type does not support email', async () => {
      await expect(
        updateUseCase.execute('user-1', {
          eventType: NotificationEventType.APPLICATION_SUBMITTED,
          emailEnabled: true,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });
  });
});
