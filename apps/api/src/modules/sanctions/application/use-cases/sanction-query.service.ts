import { Inject, Injectable, Logger } from '@nestjs/common';
import { SanctionTargetType, SanctionType } from '@campusjob/contracts';
import {
  ISanctionRepository,
  SANCTION_REPOSITORY_TOKEN,
} from '../../domain/repositories/sanction.repository.interface';
import { ApplicationLockState, ISanctionQuery } from '../ports/sanction-query.port';

@Injectable()
export class SanctionQueryService implements ISanctionQuery {
  private readonly logger = new Logger(SanctionQueryService.name);

  constructor(@Inject(SANCTION_REPOSITORY_TOKEN) private readonly repository: ISanctionRepository) {}

  async getApplicationLock(studentId: string, now: Date = new Date()): Promise<ApplicationLockState> {
    // Hết hạn chỉ tính khi đọc; ghi SanctionEvent(EXPIRED)/AuditLog lần đầu thấy hết hạn. Lỗi ghi không chặn kiểm tra.
    try {
      await this.repository.recordExpired(now, studentId);
    } catch (err: unknown) {
      this.logger.warn(`recordExpired failed for ${studentId}: ${err instanceof Error ? err.message : String(err)}`);
    }
    const active = await this.repository.findActiveByTarget(
      SanctionTargetType.STUDENT,
      studentId,
      SanctionType.APPLICATION_LOCK,
      now,
    );
    return active ? { locked: true, until: active.endsAt } : { locked: false, until: null };
  }
}
