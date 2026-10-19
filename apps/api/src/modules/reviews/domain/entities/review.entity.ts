import { ReviewVisibility } from '@campusjob/contracts';

export interface ReviewReplyProps {
  employerId: string;
  content: string;
  createdAt: Date;
}

export interface ReviewProps {
  id: string;
  applicationId: string;
  studentId: string;
  companyId: string;
  rating: number;
  comment: string | null;
  visibility: ReviewVisibility;
  createdAt: Date;
  reply: ReviewReplyProps | null;
}

export class ReviewEntity {
  readonly id: string;
  readonly applicationId: string;
  readonly studentId: string;
  readonly companyId: string;
  readonly rating: number;
  readonly comment: string | null;
  readonly visibility: ReviewVisibility;
  readonly createdAt: Date;
  readonly reply: ReviewReplyProps | null;

  constructor(props: ReviewProps) {
    this.id = props.id;
    this.applicationId = props.applicationId;
    this.studentId = props.studentId;
    this.companyId = props.companyId;
    this.rating = props.rating;
    this.comment = props.comment;
    this.visibility = props.visibility;
    this.createdAt = props.createdAt;
    this.reply = props.reply;
  }

  isVisible(): boolean {
    return this.visibility === ReviewVisibility.VISIBLE;
  }

  hasReply(): boolean {
    return this.reply !== null;
  }
}
