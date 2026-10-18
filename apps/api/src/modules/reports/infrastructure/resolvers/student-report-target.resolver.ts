import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@campusjob/contracts';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../../users/domain/repositories/user.repository.interface';
import {
  IReportTargetResolver,
  ResolvedReportTarget,
} from '../../application/ports/report-target-resolver.port';

/** Đối tượng STUDENT chính là tài khoản người dùng (M01), nên M05 tự kiểm tra qua IUserRepository. */
@Injectable()
export class StudentReportTargetResolver implements IReportTargetResolver {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async resolve(targetId: string): Promise<ResolvedReportTarget | null> {
    const user = await this.userRepository.findById(targetId);
    if (!user || user.role !== UserRole.STUDENT) {
      return null;
    }
    return { ownerUserId: user.id, label: user.fullName };
  }
}
