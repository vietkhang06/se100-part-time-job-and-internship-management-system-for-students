import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { AuthContext, AuthErrorCode } from '@campusjob/contracts';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthContext>(
    err: unknown,
    user: TUser | null | false,
    info: unknown,
    context: ExecutionContext,
    status?: number,
  ): TUser {
    void info;
    void context;
    void status;
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException({
          message: 'Vui lòng đăng nhập để tiếp tục.',
          code: AuthErrorCode.UNAUTHORIZED,
        })
      );
    }
    return user;
  }
}
