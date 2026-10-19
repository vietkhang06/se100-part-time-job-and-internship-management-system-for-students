import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SanctionDetailDto, SanctionStatus, SanctionType } from '@campusjob/contracts';
import {
  ISanctionRepository,
  SANCTION_REPOSITORY_TOKEN,
} from '../../domain/repositories/sanction.repository.interface';
import { CompanySanctionHandlerRegistry } from '../ports/company-sanction-handler.port';
import { toSanctionDetailDto } from '../dto/sanction.mapper';

@Injectable()
export class LiftSanctionUseCase {
  private readonly logger = new Logger(LiftSanctionUseCase.name);

  constructor(
    @Inject(SANCTION_REPOSITORY_TOKEN) private readonly repository: ISanctionRepository,
    private readonly companyHandlers: CompanySanctionHandlerRegistry,
  ) {}

  /** UC57 — Quản trị viên gỡ chế tài đang hiệu lực (kèm lý do, được lưu vào lịch sử). */
  async execute(admin: { id: string }, id: string, reason: string, now: Date = new Date()): Promise<SanctionDetailDto> {
    const text = reason?.trim();
    if (!text) {
      throw new BadRequestException({ message: 'Cần nhập lý do gỡ.', code: 'SANCTION_REASON_REQUIRED' });
    }

    const found = await this.repository.findById(id);
    if (!found) {
      throw new NotFoundException({ message: 'Không tìm thấy chế tài.', code: 'SANCTION_NOT_FOUND' });
    }
    const { sanction } = found;
    if (sanction.effectiveStatus(now) !== SanctionStatus.ACTIVE) {
      throw new ConflictException({
        message: 'Chế tài này không còn hiệu lực để gỡ.',
        code: 'SANCTION_NOT_ACTIVE',
      });
    }

    if (sanction.type === SanctionType.COMPANY_SUSPENSION) {
      const handler = this.companyHandlers.get();
      if (!handler) {
        throw new ServiceUnavailableException({
          message: 'Chưa thể gỡ đình chỉ doanh nghiệp lúc này.',
          code: 'SANCTION_TARGET_UNAVAILABLE',
        });
      }
      try {
        await handler.unsuspend(sanction.targetId, sanction.id);
      } catch (err: any) {
        this.logger.error(`Unsuspend company ${sanction.targetId} failed: ${err?.message}`);
        throw new BadGatewayException({
          message: 'Không thể gỡ đình chỉ doanh nghiệp lúc này. Vui lòng thử lại.',
          code: 'SANCTION_TARGET_SYNC_FAILED',
        });
      }
    }

    const lifted = await this.repository.lift(id, admin.id, text, now);
    if (!lifted) {
      throw new ConflictException({
        message: 'Chế tài này vừa được gỡ bởi người khác.',
        code: 'SANCTION_NOT_ACTIVE',
      });
    }

    const after = await this.repository.findById(id);
    return toSanctionDetailDto(lifted, after?.events ?? [], now);
  }
}
