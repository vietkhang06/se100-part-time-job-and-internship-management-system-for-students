import { Injectable } from '@nestjs/common';
import { ViolationTargetType } from '@campusjob/contracts';

export interface ResolvedReportTarget {
  /** Chủ sở hữu (user) của đối tượng, dùng để chặn tự báo cáo chính mình. null nếu không xác định. */
  ownerUserId: string | null;
  /** Nhãn hiển thị cho người thẩm tra (tên doanh nghiệp, tiêu đề tin...). */
  label: string;
}

/**
 * Module sở hữu đối tượng (M03 cho COMPANY/JOB, M05-03 cho REVIEW) cài đặt interface này
 * để M05 kiểm tra đối tượng tồn tại và đúng loại mà không đọc bảng của họ.
 */
export interface IReportTargetResolver {
  resolve(targetId: string): Promise<ResolvedReportTarget | null>;
}

@Injectable()
export class ReportTargetResolverRegistry {
  private readonly resolvers = new Map<ViolationTargetType, IReportTargetResolver>();

  register(targetType: ViolationTargetType, resolver: IReportTargetResolver): void {
    this.resolvers.set(targetType, resolver);
  }

  get(targetType: ViolationTargetType): IReportTargetResolver | undefined {
    return this.resolvers.get(targetType);
  }
}
