import { Inject, Injectable } from '@nestjs/common';
import { SanctionTargetType, SanctionType } from '@campusjob/contracts';
import {
  ISanctionRepository,
  SANCTION_REPOSITORY_TOKEN,
} from '../../domain/repositories/sanction.repository.interface';
import { ApplicationLockState, ISanctionQuery } from '../ports/sanction-query.port';

@Injectable()
export class SanctionQueryService implements ISanctionQuery {
  constructor(@Inject(SANCTION_REPOSITORY_TOKEN) private readonly repository: ISanctionRepository) {}

  async getApplicationLock(studentId: string, now: Date = new Date()): Promise<ApplicationLockState> {
    const active = await this.repository.findActiveByTarget(
      SanctionTargetType.STUDENT,
      studentId,
      SanctionType.APPLICATION_LOCK,
      now,
    );
    return active ? { locked: true, until: active.endsAt } : { locked: false, until: null };
  }
}
