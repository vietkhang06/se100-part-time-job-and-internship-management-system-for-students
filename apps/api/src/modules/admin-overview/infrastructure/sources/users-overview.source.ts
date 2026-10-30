import { Injectable } from '@nestjs/common';
import { OverviewGroupKey, UserRole } from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  IOverviewSource,
  OverviewSourceResult,
} from '../../application/ports/overview-source.port';

const ROLE_LABEL: Record<string, string> = {
  [UserRole.STUDENT]: 'Sinh viên',
  [UserRole.EMPLOYER]: 'Nhà tuyển dụng',
  [UserRole.MODERATOR]: 'Kiểm duyệt viên',
  [UserRole.ADMIN]: 'Quản trị viên',
};

/**
 * Số người dùng theo vai trò (M01). Chỉ ĐỌC bảng User bằng truy vấn đếm; không đổi dữ liệu hay quy tắc của M01.
 * (Quyết định cần xác nhận: đọc trực tiếp hay qua repository của M01 — xem ADMIN_OVERVIEW_API_CONTRACT.md.)
 */
@Injectable()
export class UsersOverviewSource implements IOverviewSource {
  readonly key = OverviewGroupKey.USERS;

  constructor(private readonly prisma: PrismaService) {}

  async collect(): Promise<OverviewSourceResult> {
    const rows = await this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } });
    const counts = new Map<string, number>(rows.map((r) => [String(r.role), r._count._all]));

    const breakdown = Object.values(UserRole).map((role) => ({
      key: role,
      label: ROLE_LABEL[role] ?? role,
      count: counts.get(role) ?? 0,
    }));
    return {
      total: breakdown.reduce((sum, item) => sum + item.count, 0),
      breakdownLabel: 'Theo vai trò',
      breakdown,
    };
  }
}
