import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { UserStatus, AuthUserDto } from '@campusjob/contracts';
import {
  USER_REPOSITORY_TOKEN,
  IUserRepository,
} from '../../../users/domain/repositories/user.repository.interface';
import {
  AUTH_SESSION_REPOSITORY_TOKEN,
  IAuthSessionRepository,
} from '../../domain/repositories/auth-session.repository.interface';
import { LoginDto } from '../dto/login.dto';
import { PasswordHasher } from '../../infrastructure/security/password-hasher';
import { TokenUtils } from '../../infrastructure/security/token.utils';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);
  private readonly refreshTtlDays: number;

  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(AUTH_SESSION_REPOSITORY_TOKEN)
    private readonly authSessionRepository: IAuthSessionRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.refreshTtlDays = Number(
      this.configService.get<number>('REFRESH_TOKEN_TTL_DAYS', 30),
    );
  }

  async execute(
    dto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<LoginResult> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Tài khoản đã bị đình chỉ hoạt động.');
    }

    if (user.status === UserStatus.LOCKED) {
      throw new ForbiddenException(
        'Tài khoản đang bị khóa tạm thời. Vui lòng liên hệ quản trị viên.',
      );
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException(
        'Tài khoản chưa được xác minh email. Vui lòng kiểm tra email để kích hoạt hoặc yêu cầu gửi lại mã.',
      );
    }

    const isMatch = await PasswordHasher.verify(user.passwordHash, dto.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    // Generate Refresh Token & Session
    const rawRefreshToken = TokenUtils.generateRandomToken(40);
    const tokenHash = TokenUtils.hashToken(rawRefreshToken);
    const tokenFamily = uuidv4();
    const expiresAt = new Date(
      Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000,
    );

    const session = await this.authSessionRepository.create({
      userId: user.id,
      tokenHash,
      tokenFamily,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
      expiresAt,
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    this.logger.log(`User logged in successfully: ${user.id} (${user.email})`);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
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
