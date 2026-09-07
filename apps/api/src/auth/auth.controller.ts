import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { adminLoginSchema, type AdminLoginInput } from '@zhs/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminGuard, type AuthenticatedRequest } from './admin.guard';
import { AuthService } from './auth.service';

const ACCESS_COOKIE = 'zhs_admin';
const REFRESH_COOKIE = 'zhs_admin_refresh';

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // 'strict' rather than 'lax': there is no legitimate cross-site navigation
    // into the admin area, so this closes off CSRF on state-changing routes.
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(adminLoginSchema)) body: AdminLoginInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });

    response.cookie(ACCESS_COOKIE, result.accessToken, cookieOptions(15 * 60));
    response.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions(7 * 24 * 60 * 60));

    // The tokens themselves are never returned in the body — they live only in
    // httpOnly cookies, out of reach of any script on the page.
    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = (request.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    const result = await this.auth.refresh(token ?? '');

    response.cookie(ACCESS_COOKIE, result.accessToken, cookieOptions(15 * 60));
    response.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions(7 * 24 * 60 * 60));

    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout((request.cookies as Record<string, string>)?.[REFRESH_COOKIE]);
    response.clearCookie(ACCESS_COOKIE, { path: '/' });
    response.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.admin };
  }
}
