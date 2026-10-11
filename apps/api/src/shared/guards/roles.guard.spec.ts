import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole, AuthErrorCode } from '@campusjob/contracts';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockExecutionContext(options: {
    user?: any;
    headers?: Record<string, any>;
    query?: Record<string, any>;
    body?: Record<string, any>;
    isPublic?: boolean;
    requiredRoles?: UserRole[];
  }): ExecutionContext {
    const handler = () => {};
    const targetClass = class {};

    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) {
        return options.isPublic ?? false;
      }
      if (key === ROLES_KEY) {
        return options.requiredRoles;
      }
      return undefined;
    });

    const mockRequest = {
      user: options.user,
      headers: options.headers || {},
      query: options.query || {},
      body: options.body || {},
    };

    return {
      getHandler: () => handler,
      getClass: () => targetClass,
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  describe('Public routes', () => {
    it('should allow access if route is marked as @Public() even if no user is present', () => {
      const context = createMockExecutionContext({
        isPublic: true,
        requiredRoles: [UserRole.ADMIN],
        user: undefined,
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('Unrestricted routes (no @Roles specified)', () => {
    it('should allow access if no role metadata is present on route or class', () => {
      const context = createMockExecutionContext({
        requiredRoles: undefined,
        user: { id: 'u1', role: UserRole.STUDENT },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access if requiredRoles is an empty array', () => {
      const context = createMockExecutionContext({
        requiredRoles: [],
        user: { id: 'u1', role: UserRole.STUDENT },
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('Missing or malformed authenticated user context', () => {
    it('should throw UnauthorizedException when route requires a role but req.user is undefined', () => {
      const context = createMockExecutionContext({
        requiredRoles: [UserRole.ADMIN],
        user: undefined,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      try {
        guard.canActivate(context);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: AuthErrorCode.UNAUTHORIZED,
        });
      }
    });

    it('should throw UnauthorizedException when route requires a role but req.user.role is missing', () => {
      const context = createMockExecutionContext({
        requiredRoles: [UserRole.ADMIN],
        user: { id: 'u1' }, // no role
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      try {
        guard.canActivate(context);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: AuthErrorCode.UNAUTHORIZED,
        });
      }
    });
  });

  describe('Role evaluation and access decision', () => {
    it('should allow access when user role exactly matches the required role', () => {
      const context = createMockExecutionContext({
        requiredRoles: [UserRole.ADMIN],
        user: { id: 'u-admin', role: UserRole.ADMIN },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException when user role does not match single required role', () => {
      const context = createMockExecutionContext({
        requiredRoles: [UserRole.ADMIN],
        user: { id: 'u-student', role: UserRole.STUDENT },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      try {
        guard.canActivate(context);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: AuthErrorCode.FORBIDDEN,
          message: 'Bạn không có quyền truy cập tài nguyên này.',
        });
      }
    });

    it('should allow access when user role is in multiple allowed roles', () => {
      const contextStudent = createMockExecutionContext({
        requiredRoles: [UserRole.STUDENT, UserRole.EMPLOYER],
        user: { id: 'u-student', role: UserRole.STUDENT },
      });
      const contextEmployer = createMockExecutionContext({
        requiredRoles: [UserRole.STUDENT, UserRole.EMPLOYER],
        user: { id: 'u-employer', role: UserRole.EMPLOYER },
      });

      expect(guard.canActivate(contextStudent)).toBe(true);
      expect(guard.canActivate(contextEmployer)).toBe(true);
    });

    it('should reject when user role is not in multiple allowed roles', () => {
      const contextModerator = createMockExecutionContext({
        requiredRoles: [UserRole.STUDENT, UserRole.EMPLOYER],
        user: { id: 'u-mod', role: UserRole.MODERATOR },
      });

      expect(() => guard.canActivate(contextModerator)).toThrow(ForbiddenException);
      try {
        guard.canActivate(contextModerator);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: AuthErrorCode.FORBIDDEN,
        });
      }
    });
  });

  describe('Security: Untrusted client-controlled fields', () => {
    it('should ignore client-controlled header or body attempting role elevation', () => {
      // User is verified as STUDENT in req.user, but client sent headers/body trying to forge ADMIN
      const context = createMockExecutionContext({
        requiredRoles: [UserRole.ADMIN],
        user: { id: 'u-student', role: UserRole.STUDENT },
        headers: { 'x-user-role': 'ADMIN', role: 'ADMIN' },
        query: { role: 'ADMIN' },
        body: { role: 'ADMIN' },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('Precedence behavior', () => {
    it('should use Reflector.getAllAndOverride with [handler, class] to ensure method overrides controller', () => {
      const realReflector = new Reflector();
      const realGuard = new RolesGuard(realReflector);

      class BaseController {}
      const handlerFn = () => {};

      // Set class-level metadata to ADMIN
      Reflect.defineMetadata(ROLES_KEY, [UserRole.ADMIN], BaseController);
      // Set handler-level metadata to STUDENT
      Reflect.defineMetadata(ROLES_KEY, [UserRole.STUDENT], handlerFn);

      const context = {
        getHandler: () => handlerFn,
        getClass: () => BaseController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'u1', role: UserRole.STUDENT },
          }),
        }),
      } as unknown as ExecutionContext;

      // Method-level STUDENT overrides class-level ADMIN, so STUDENT user is permitted
      expect(realGuard.canActivate(context)).toBe(true);

      const contextAdmin = {
        getHandler: () => handlerFn,
        getClass: () => BaseController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'u-admin', role: UserRole.ADMIN },
          }),
        }),
      } as unknown as ExecutionContext;

      // And ADMIN is forbidden on this handler because handler only allows STUDENT
      expect(() => realGuard.canActivate(contextAdmin)).toThrow(ForbiddenException);
    });
  });
});
