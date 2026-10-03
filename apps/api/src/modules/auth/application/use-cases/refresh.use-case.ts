import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserStatus, AuthUserDto } from '@campusjob/contracts';
import {
  USER_REPOSITORY_TOKEN,
  IUserRepository,
} from '../../../users/domain/repositories/user.repository.interface';
import {
  AUTH_SESSION_REPOSITORY_TOKEN,
  IAuthSessionRepository,
} from '../../domain/repositories/auth-session.repository.interface';
import { TokenUtils } from '../../infrastructure/security/token.utils';

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

@Injectable()
export class RefreshUseCase {
  private readonly logger = new Logger(RefreshUseCase.name);
  private readonly refreshTtlDays: number;

  constructor(
    @Inject(AUTH_SESSION_REPOSITORY_TOKEN)
    private readonly authSessionRepository: IAuthSessionRepository,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.refreshTtlDays = Number(
      this.configService.get<number>('REFRESH_TOKEN_TTL_DAYS', 30),
    );
  }

  async execute(
    refreshToken?: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<RefreshResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Không tìm thấy refresh token.');
    }

    const tokenHash = TokenUtils.hashToken(refreshToken);
    const session = await this.authSessionRepository.findByTokenHash(tokenHash);

    if (!session) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }

    // Reuse detection: If session was already revoked, revoke the entire token family!
    if (session.isRevoked()) {
      this.logger.warn(
        `Refresh token reuse detected for family ${session.tokenFamily}! Revoking all sessions.`,
      );
      await this.authSessionRepository.revokeFamily(session.tokenFamily);
      throw new UnauthorizedException(
        'Phát hiện hành vi sử dụng lại token đã thu hồi. Tất cả phiên đăng nhập liên quan đã bị hủy.',
      );
    }

    if (session.isExpired()) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    // Rotate token
    const newRefreshToken = TokenUtils.generateRandomToken(40);
    const newTokenHash = TokenUtils.hashToken(newRefreshToken);
    const expiresAt = new Date(
      Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000,
    );

    const newSession = await this.authSessionRepository.rotateSession(
      session.id,
      {
        userId: session.userId,
        tokenHash: newTokenHash,
        tokenFamily: session.tokenFamily,
        userAgent: userAgent ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt,
      },
    );

    const user = await this.userRepository.findById(session.userId);
    if (!user || user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Tài khoản không hợp lệ hoặc đã bị khóa.');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: newSession.id,
    });

    this.logger.log(`Session refreshed successfully for user: ${user.id}`);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        emailVerified: user.isVerified(),
      },
    };
  }
}
