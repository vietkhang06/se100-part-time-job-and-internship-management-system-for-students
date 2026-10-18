import { NotFoundException } from '@nestjs/common';
import { ViolationReason, ViolationReportStatus, ViolationTargetType } from '@campusjob/contracts';
import { GetReportUseCase } from './get-report.use-case';
import { ViolationReportEntity } from '../../domain/entities/violation-report.entity';

const report = new ViolationReportEntity({
  id: 'r1', reporterId: 'u1', targetType: ViolationTargetType.JOB, targetId: 'j1', targetLabel: 'Job',
  reason: ViolationReason.SPAM, description: 'x'.repeat(30), status: ViolationReportStatus.SUBMITTED,
  evidence: [{ id: 'e1', kind: 'URL', url: 'https://a.b/c', note: null }], moderatedAt: null, resolvedAt: null, createdAt: new Date(),
});

describe('GetReportUseCase', () => {
  const repo = { findById: jest.fn() };
  const useCase = new GetReportUseCase(repo as any);

  it('lets the reporter see their own report', async () => {
    repo.findById.mockResolvedValue(report);
    const dto = await useCase.forReporter('r1', 'u1');
    expect(dto.evidenceCount).toBe(1);
  });

  it('hides other people\'s reports behind 404', async () => {
    repo.findById.mockResolvedValue(report);
    await expect(useCase.forReporter('r1', 'other')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gives reviewers the reporter id', async () => {
    repo.findById.mockResolvedValue(report);
    expect((await useCase.forReview('r1')).reporterId).toBe('u1');
  });
});
