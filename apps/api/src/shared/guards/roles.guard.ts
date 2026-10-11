import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, AuthErrorCode } from '@campusjob/contracts';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified, route is open to any authenticated user (or public if no auth guard)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Safe handling when user context is missing or unauthenticated
    if (!user || !user.role) {
      throw new UnauthorizedException({
        message: 'Vui lòng đăng nhập để tiếp tục.',
        code: AuthErrorCode.UNAUTHORIZED,
      });
    }

    const hasRequiredRole = requiredRoles.includes(user.role as UserRole);
    if (!hasRequiredRole) {
      throw new ForbiddenException({
        message: 'Bạn không có quyền truy cập tài nguyên này.',
        code: AuthErrorCode.FORBIDDEN,
      });
    }

    return true;
  }
}
