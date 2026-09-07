import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService, type AdminPrincipal, type AdminRole } from './auth.service';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to particular roles.
 *
 * `editor` covers content — products, pages, images, contributors.
 * `admin` additionally covers orders, refunds, shipping rates and user
 * management. The Publishing Associate is an editor, so anything touching money
 * must carry @Roles('admin').
 */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthenticatedRequest extends Request {
  admin?: AdminPrincipal;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // The access token arrives in an httpOnly cookie set by the web app. The
    // Authorization header is accepted too, for scripts and tests.
    const cookieToken = (request.cookies as Record<string, string> | undefined)?.zhs_admin;
    const header = request.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = cookieToken ?? bearer;

    if (!token) {
      throw new UnauthorizedException('Not signed in.');
    }

    const principal = await this.auth.verifyAccessToken(token);
    request.admin = principal;

    const required = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles on the route means any authenticated admin user may reach it.
    if (!required || required.length === 0) return true;

    if (!required.includes(principal.role)) {
      throw new ForbiddenException('Your account does not have access to this.');
    }

    return true;
  }
}
