import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  RegisterResponseDto,
  VerifyEmailResponseDto,
  ResendVerificationResponseDto,
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
  LoginResponseDto,
  RefreshResponseDto,
  LogoutResponseDto,
  MeResponseDto,
} from '@campusjob/contracts';
import { RegisterDto } from '../../application/dto/register.dto';
import { VerifyEmailDto } from '../../application/dto/verify-email.dto';
import { ResendVerificationDto } from '../../application/dto/resend-verification.dto';
import { ForgotPasswordDto } from '../../application/dto/forgot-password.dto';
import { ResetPasswordDto } from '../../application/dto/reset-password.dto';
import { LoginDto } from '../../application/dto/login.dto';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { VerifyEmailUseCase } from '../../application/use-cases/verify-email.use-case';
import { ResendVerificationUseCase } from '../../application/use-cases/resend-verification.use-case';
import { ForgotPasswordUseCase } from '../../application/use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RefreshUseCase } from '../../application/use-cases/refresh.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { LogoutAllUseCase } from '../../application/use-cases/logout-all.use-case';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { Public } from '../../../../shared/decorators/public.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly isCookieSecure: boolean;
  private readonly cookieDomain?: string;
  private readonly cookieName: string;
  private readonly refreshTtlDays: number;

  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly resendVerificationUseCase: ResendVerificationUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllUseCase: LogoutAllUseCase,
    private readonly configService: ConfigService,
  ) {
    this.isCookieSecure =
      this.configService.get<string>('COOKIE_SECURE') === 'true' ||
      this.configService.get<boolean>('cookieSecure', false);
    this.cookieDomain =
      this.configService.get<string>('COOKIE_DOMAIN') ||
      this.configService.get<string>('cookieDomain');
    this.cookieName =
      this.configService.get<string>('COOKIE_NAME') || 'campusjob_refresh_token';
    this.refreshTtlDays = Number(
      this.configService.get<number>('REFRESH_TOKEN_TTL_DAYS', 30),
    );
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.isCookieSecure,
      sameSite: 'lax',
      path: '/api/v1/auth',
      domain: this.cookieDomain,
      maxAge: this.refreshTtlDays * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.isCookieSecure,
      sameSite: 'lax',
      path: '/api/v1/auth',
      domain: this.cookieDomain,
    });
    // Also clear generic 'refreshToken' cookie name if present
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.isCookieSecure,
      sameSite: 'lax',
      path: '/api/v1/auth',
      domain: this.cookieDomain,
    });
  }

  private extractRefreshToken(req: Request): string | undefined {
    return (
      req.cookies?.[this.cookieName] ||
      req.cookies?.['refreshToken'] ||
      (req.headers['x-refresh-token'] as string)
    );
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new Student or Employer account' })
  @ApiResponse({
    status: 201,
    description: 'Registration successful. Verification email dispatched.',
  })
  @ApiResponse({ status: 400, description: 'Validation failed or disallowed role' })
  @ApiResponse({ status: 409, description: 'Email is already registered' })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.registerUseCase.execute(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful. Returns access token and sets HttpOnly refresh cookie.' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({ status: 403, description: 'Account locked, suspended, or pending verification' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await this.loginUseCase.execute(dto, userAgent, ipAddress);
    this.setRefreshCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or reused refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    const refreshToken = this.extractRefreshToken(req);
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await this.refreshUseCase.execute(refreshToken, userAgent, ipAddress);
    this.setRefreshCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout current session and clear refresh cookie' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    const refreshToken = this.extractRefreshToken(req);
    const result = await this.logoutUseCase.execute(refreshToken);
    this.clearRefreshCookie(res);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all active sessions for current user' })
  @ApiResponse({ status: 200, description: 'All sessions revoked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    const result = await this.logoutAllUseCase.execute(userId);
    this.clearRefreshCookie(res);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Returns authenticated user info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser() user: any): Promise<MeResponseDto> {
    return { user };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address using one-time token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid, expired, or already used token' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    return this.verifyEmailUseCase.execute(dto);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email to unverified account' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  @ApiResponse({ status: 400, description: 'Account already verified' })
  @ApiResponse({ status: 429, description: 'Cooldown in effect (wait before resending)' })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<ResendVerificationResponseDto> {
    return this.resendVerificationUseCase.execute(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({
    status: 200,
    description: 'Instructions sent if account exists (neutral response)',
  })
  @ApiResponse({ status: 429, description: 'Cooldown in effect' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponseDto> {
    return this.forgotPasswordUseCase.execute(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid/expired token or weak password' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<ResetPasswordResponseDto> {
    return this.resetPasswordUseCase.execute(dto);
  }
}
