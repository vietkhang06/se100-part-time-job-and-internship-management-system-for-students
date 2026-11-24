import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  IApplicationReviewSource,
  ReviewSourcesRegistry,
} from '../../reviews/application/ports/review-sources.port';
import { M04Repository } from '../application/m04-ports';

@Injectable()
export class ApplicationReviewSourceAdapter implements IApplicationReviewSource, OnModuleInit {
  constructor(
    private readonly repository: M04Repository,
    private readonly registry: ReviewSourcesRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.registerApplicationSource(this);
  }

  async getOwnedApplication(studentId: string, applicationId: string) {
    const application = await this.repository.getApplication(applicationId);
    return application?.studentId === studentId
      ? { applicationId: application.id, jobId: application.jobId, status: application.status }
      : null;
  }
}
