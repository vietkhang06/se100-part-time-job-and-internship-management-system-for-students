import { ReviewSourcesRegistry } from '../../reviews/application/ports/review-sources.port';
import { ApplicationStatus } from '../domain/application-state';
import { ApplicationReviewSourceAdapter } from './application-review-source.adapter';
import { M04Repository } from '../application/m04-ports';

describe('ApplicationReviewSourceAdapter', () => {
  const application = {
    id: 'app-1', studentId: 'student-1', jobId: 'job-1', status: ApplicationStatus.ACCEPTED,
  };
  const repository = {
    getApplication: jest.fn(async () => application),
  } as unknown as M04Repository;

  it('registers the production source and returns only an owned application', async () => {
    const registry = new ReviewSourcesRegistry();
    const source = new ApplicationReviewSourceAdapter(repository, registry);
    source.onModuleInit();

    expect(registry.getApplicationSource()).toBe(source);
    await expect(source.getOwnedApplication('student-1', 'app-1')).resolves.toEqual({
      applicationId: 'app-1', jobId: 'job-1', status: ApplicationStatus.ACCEPTED,
    });
    await expect(source.getOwnedApplication('student-2', 'app-1')).resolves.toBeNull();
  });
});
