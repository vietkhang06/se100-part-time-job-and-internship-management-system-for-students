import { Injectable, UnauthorizedException, ForbiddenException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserStatus, AuthErrorCode, AuthContext } from '@campusjob/contracts';
import {
  USER_REPOSITORY_TOKEN,
  IUserRepository,
} from '../../../users/domain/repositories/user.repository.interface';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sessionId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_ACCESS_SECRET',
        'replace_with_long_random_access_secret',
      ),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthContext> {
    const user = await this.userRepository.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException({
        message: 'Tài khoản không tồn tại.',
        code: AuthErrorCode.UNAUTHORIZED,
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        message: 'Tài khoản đã bị đình chỉ hoạt động.',
        code: AuthErrorCode.ACCOUNT_SUSPENDED,
      });
    }

    if (user.status === UserStatus.LOCKED) {
      throw new ForbiddenException({
        message: 'Tài khoản đang bị khóa tạm thời. Vui lòng liên hệ quản trị viên.',
        code: AuthErrorCode.ACCOUNT_LOCKED,
      });
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException({
        message:
          'Tài khoản chưa được xác minh email. Vui lòng kiểm tra email để kích hoạt hoặc yêu cầu gửi lại mã.',
        code: AuthErrorCode.ACCOUNT_PENDING_VERIFICATION,
      });
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      phone: user.phone,
      emailVerified: user.isVerified(),
      sessionId: payload.sessionId,
    };
  }
}
