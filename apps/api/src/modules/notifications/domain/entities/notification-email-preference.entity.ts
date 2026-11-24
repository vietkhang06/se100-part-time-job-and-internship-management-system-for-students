import { NotificationEventType } from '@campusjob/contracts';

export interface NotificationEmailPreferenceProps {
  id: string;
  userId: string;
  eventType: NotificationEventType | string;
  emailEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationEmailPreferenceEntity {
  readonly id: string;
  readonly userId: string;
  readonly eventType: string;
  readonly emailEnabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: NotificationEmailPreferenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.eventType = props.eventType;
    this.emailEnabled = props.emailEnabled;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
