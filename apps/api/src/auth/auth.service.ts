import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { schema, type Database } from '@zhs/db';
import type { AdminLoginInput } from '@zhs/shared';
import { DB } from '../db/db.module';

export type AdminRole = 'admin' | 'editor';

export interface AdminPrincipal {
  id: number;
  email: string;
  name: string;
  role: AdminRole;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AdminPrincipal;
}

const ACCESS_TTL = '15m';
const REFRESH_TTL_DAYS = 7;

/**
 * A real hash of a random secret, generated once at startup and verified
 * against whenever no user is found.
 *
 * Without it, a login for a non-existent address returns in microseconds while
 * a real address takes ~50ms of argon2 work — a reliable oracle for
 * enumerating who has an account. It has to be a *genuine* hash: a hand-written
 * placeholder fails to parse and returns immediately, which leaves the timing
 * difference exactly where it was.
 */
const dummyHashPromise = argonHash(randomBytes(32).toString('hex'));

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  static hashPassword(password: string): Promise<string> {
    // Defaults are argon2id, 19MiB, t=2, p=1 — the OWASP-recommended profile.
    return argonHash(password);
  }

  /** Refresh tokens are stored hashed, so a database read cannot be replayed. */
  private static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async login(
    input: AdminLoginInput,
    context: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<LoginResult> {
    const user = await this.db.query.adminUsers.findFirst({
      where: eq(schema.adminUsers.email, input.email),
    });

    // Always do the argon2 work, even with no user, so timing is flat.
    const storedHash = user?.passwordHash ?? (await dummyHashPromise);
    let passwordOk = false;
    try {
      passwordOk = await argonVerify(storedHash, input.password);
    } catch {
      passwordOk = false;
    }

    // One message for every failure mode. "No such user" and "wrong password"
    // must be indistinguishable from outside.
    if (!user || !passwordOk || user.disabledAt) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    const principal: AdminPrincipal = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const tokens = await this.issueTokens(principal, context);

    await this.db
      .update(schema.adminUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.adminUsers.id, user.id));

    this.logger.log(`Admin login: ${user.email} (${user.role})`);
    return tokens;
  }

  /** Mints an access/refresh pair and records the session. */
  private async issueTokens(
    principal: AdminPrincipal,
    context: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<LoginResult> {
    const accessToken = await this.jwt.signAsync(
      {
        sub: principal.id,
        email: principal.email,
        role: principal.role,
        name: principal.name,
      },
      { expiresIn: ACCESS_TTL },
    );

    const refreshToken = randomBytes(48).toString('hex');

    await this.db.insert(schema.adminSessions).values({
      userId: principal.id,
      tokenHash: AuthService.hashToken(refreshToken),
      userAgent: context.userAgent?.slice(0, 320) ?? null,
      ipAddress: context.ipAddress?.slice(0, 45) ?? null,
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken, user: principal };
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    const session = await this.db.query.adminSessions.findFirst({
      where: and(
        eq(schema.adminSessions.tokenHash, AuthService.hashToken(refreshToken)),
        isNull(schema.adminSessions.revokedAt),
        gt(schema.adminSessions.expiresAt, new Date()),
      ),
      with: { user: true },
    });

    const user = session?.user as typeof schema.adminUsers.$inferSelect | undefined;
    if (!session || !user || user.disabledAt) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    // Rotate on every use: a stolen refresh token is usable at most once, and
    // the legitimate holder's next attempt fails loudly rather than silently
    // sharing the session.
    await this.db
      .update(schema.adminSessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.adminSessions.id, session.id));

    return this.issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.db
      .update(schema.adminSessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.adminSessions.tokenHash, AuthService.hashToken(refreshToken)));
  }

  async verifyAccessToken(token: string): Promise<AdminPrincipal> {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: number;
        email: string;
        name: string;
        role: AdminRole;
      }>(token);
      return { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
    } catch {
      throw new UnauthorizedException('Not signed in.');
    }
  }

  /** Used by the seed script and by admin user management. */
  async createUser(input: {
    email: string;
    name: string;
    password: string;
    role: AdminRole;
  }): Promise<number> {
    const passwordHash = await AuthService.hashPassword(input.password);
    const [inserted] = await this.db.insert(schema.adminUsers).values({
      email: input.email,
      name: input.name,
      passwordHash,
      role: input.role,
    });
    return Number((inserted as unknown as { insertId: number }).insertId);
  }
}

/** Exported for tests: constant-time string compare used by session handling. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
