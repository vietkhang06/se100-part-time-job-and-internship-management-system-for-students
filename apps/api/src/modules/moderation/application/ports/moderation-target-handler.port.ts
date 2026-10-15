import { Injectable, Logger } from '@nestjs/common';
import {
  ModerationDecisionType,
  ModerationStatus,
  ModerationTargetType,
} from '@campusjob/contracts';

export interface ModerationDecisionContext {
  itemId: string;
  decisionId: string;
  targetType: ModerationTargetType;
  targetId: string;
  decision: ModerationDecisionType;
  newStatus: ModerationStatus;
  reason: string | null;
  proposedAction: string | null;
  reviewerId: string;
}

/**
 * Module sở hữu đối tượng (M03 cho JOB, M05-02 cho REPORT, M05-03 cho REVIEW) cài đặt interface này
 * để áp dụng quyết định lên dữ liệu của chính họ. M05 KHÔNG tự ghi vào bảng của module khác.
 * Phải idempotent: có thể được gọi lại khi đồng bộ lại.
 */
export interface IModerationTargetHandler {
  applyDecision(context: ModerationDecisionContext): Promise<void>;
}

/**
 * Nơi các module đăng ký handler (thường trong onModuleInit) mà không tạo phụ thuộc vòng.
 * Chưa có handler cho một loại đối tượng → quyết định vẫn được lưu và đánh dấu chưa đồng bộ.
 */
@Injectable()
export class ModerationTargetHandlerRegistry {
  private readonly logger = new Logger(ModerationTargetHandlerRegistry.name);
  private readonly handlers = new Map<ModerationTargetType, IModerationTargetHandler>();

  register(targetType: ModerationTargetType, handler: IModerationTargetHandler): void {
    if (this.handlers.has(targetType)) {
      this.logger.warn(`Handler for ${targetType} is being replaced`);
    }
    this.handlers.set(targetType, handler);
  }

  get(targetType: ModerationTargetType): IModerationTargetHandler | undefined {
    return this.handlers.get(targetType);
  }
}
