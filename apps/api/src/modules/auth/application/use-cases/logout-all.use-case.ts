import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  AUTH_SESSION_REPOSITORY_TOKEN,
  IAuthSessionRepository,
} from '../../domain/repositories/auth-session.repository.interface';

@Injectable()
export class LogoutAllUseCase {
  private readonly logger = new Logger(LogoutAllUseCase.name);

  constructor(
    @Inject(AUTH_SESSION_REPOSITORY_TOKEN)
    private readonly authSessionRepository: IAuthSessionRepository,
  ) {}

  async execute(userId: string): Promise<{ ok: boolean; message: string }> {
    await this.authSessionRepository.revokeAllForUser(userId);
    this.logger.log(`All sessions revoked for user: ${userId}`);
    return { ok: true, message: 'Đã thu hồi tất cả phiên đăng nhập.' };
  }
}
