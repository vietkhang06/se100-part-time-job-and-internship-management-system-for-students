import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { M04Workflow } from '../src/modules/applications/application/m04-workflow';
import { M04WorkflowError } from '../src/modules/applications/application/m04-ports';
import { M04Controller } from '../src/modules/applications/presentation/m04.controller';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';
import { RolesGuard } from '../src/shared/guards/roles.guard';

class FixtureJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const id = req.headers['x-test-user'];
    const role = req.headers['x-test-role'];
    if (!id || !role) return false;
    req.user = { id, role };
    return true;
  }
}

describe('M04 API contract with fixture adapters', () => {
  let app: INestApplication;
  const workflow = {
    submit: jest.fn(), getMine: jest.fn(), markViewed: jest.fn(),
    getCandidate: jest.fn(), invite: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [M04Controller],
      providers: [
        { provide: M04Workflow, useValue: workflow },
        RolesGuard,
      ],
    }).overrideGuard(JwtAuthGuard).useClass(FixtureJwtGuard).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });
  beforeEach(() => jest.clearAllMocks());

  it('accepts a student application request and passes only authenticated identity to the workflow', async () => {
    workflow.submit.mockResolvedValue({ id: 'app-1' });
    await request(app.getHttpServer()).post('/api/v1/jobs/job-a/apply')
      .set('x-test-user', 'student-a').set('x-test-role', 'STUDENT')
      .send({ cvId: 'cv-1', coverLetter: 'Hello' })
      .expect(201, { id: 'app-1' });
    expect(workflow.submit).toHaveBeenCalledWith('student-a', 'job-a', 'cv-1', 'Hello');
  });

  it('blocks the wrong role and rejects an invalid application request', async () => {
    await request(app.getHttpServer()).post('/api/v1/jobs/job-a/apply')
      .set('x-test-user', 'employer-a').set('x-test-role', 'EMPLOYER')
      .send({ cvId: 'cv-1' }).expect(403);
    await request(app.getHttpServer()).post('/api/v1/jobs/job-a/apply')
      .set('x-test-user', 'student-a').set('x-test-role', 'STUDENT')
      .send({ cvId: '' }).expect(400);
    expect(workflow.submit).not.toHaveBeenCalled();
  });

  it('maps resource ownership errors to 404/403 without leaking application data', async () => {
    workflow.getMine.mockRejectedValue(new M04WorkflowError('NOT_FOUND'));
    await request(app.getHttpServer()).get('/api/v1/applications/me/app-foreign')
      .set('x-test-user', 'student-a').set('x-test-role', 'STUDENT')
      .expect(404);
    workflow.getCandidate.mockRejectedValue(new M04WorkflowError('FORBIDDEN'));
    await request(app.getHttpServer()).get('/api/v1/employer/applications/app-foreign')
      .set('x-test-user', 'employer-a').set('x-test-role', 'EMPLOYER')
      .expect(403);
  });

  it('validates invitation input before calling the workflow', async () => {
    await request(app.getHttpServer()).post('/api/v1/employer/applications/app-1/interviews')
      .set('x-test-user', 'employer-a').set('x-test-role', 'EMPLOYER')
      .send({ scheduledAt: 'not-a-date', mode: 'ONLINE', locationOrLink: 'https://example.org' })
      .expect(400);
    expect(workflow.invite).not.toHaveBeenCalled();
  });

  it('maps QUOTA_EXCEEDED to HTTP 409 with explicit error code (S3-M04-03)', async () => {
    workflow.submit.mockRejectedValue(new M04WorkflowError('QUOTA_EXCEEDED'));
    const res = await request(app.getHttpServer()).post('/api/v1/jobs/job-a/apply')
      .set('x-test-user', 'student-a').set('x-test-role', 'STUDENT')
      .send({ cvId: 'cv-1' })
      .expect(409);
    expect(res.body.code).toBe('QUOTA_EXCEEDED');
  });
});

