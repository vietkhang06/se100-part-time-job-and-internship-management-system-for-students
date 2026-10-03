import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  AUTH_SESSION_REPOSITORY_TOKEN,
  IAuthSessionRepository,
} from '../../domain/repositories/auth-session.repository.interface';
import { TokenUtils } from '../../infrastructure/security/token.utils';

@Injectable()
export class LogoutUseCase {
  private readonly logger = new Logger(LogoutUseCase.name);

  constructor(
    @Inject(AUTH_SESSION_REPOSITORY_TOKEN)
    private readonly authSessionRepository: IAuthSessionRepository,
  ) {}

  async execute(refreshToken?: string): Promise<{ ok: boolean; message: string }> {
    if (refreshToken) {
      const tokenHash = TokenUtils.hashToken(refreshToken);
      const session = await this.authSessionRepository.findByTokenHash(tokenHash);
      if (session) {
        await this.authSessionRepository.revokeById(session.id);
        this.logger.log(`Session ${session.id} revoked on logout`);
      }
    }

    return { ok: true, message: 'Đăng xuất thành công.' };
  }
}
