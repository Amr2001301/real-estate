import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { companyAccessAllowed, companyAccessDenied } from '../../common/tenant/company-access';
import { claimSyntheticPeers } from '../../common/utils/identity-claim';
import { canonicalEmail, canonicalPhone } from '../../common/utils/identity-normalize';
import { getRequiredCompanyId, getTenantContext, runTenantContext } from '../../common/tenant/tenant-context';
import { phoneForWrite } from '../../common/utils/phone-for-write';
import { isUniqueConflictOn } from '../../common/utils/contract-number';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { CapabilityService } from '../../common/capabilities/capability.service';
import type { Prisma, UserRole } from '@prisma/client';
import { reportFailure } from '../../common/observability/report-failure';
import { currentClientMeta } from '../../common/request/client-meta';

// MT-035: Response header emitted on legacy /auth/login to signal deprecation.
export const DEPRECATED_ENDPOINT_HEADER = 'Deprecation';

const OTP_TTL_MIN = 10;
const OTP_MAX_ATTEMPTS = 5;
/** Codes a phone can be sent per purpose in an hour — a cap on guesses too. */
const OTP_MAX_PER_HOUR = 5;
/** OtpCode.purpose: a code is accepted only for what it was sent for. */
const OTP_LOGIN = 'LOGIN';
const OTP_PHONE_CHANGE = 'PHONE_CHANGE';
const RESET_TTL_MIN = 20;
const VERIFY_TTL_MIN = 60;
const VERIFY_RESEND_COOLDOWN_MS = 60_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
    private readonly capabilityService: CapabilityService,
  ) {}

  // ------------- Email + password (Admin / Sales / Broker) -------------

  async loginEmail(email: string, password: string) {
    // Option B — email is unique per company, not platform-wide, so this
    // tenant-less legacy route can match several accounts. The password picks
    // the account: checking it against each candidate means a wrong password
    // still reads as "Invalid credentials", whether the email exists once,
    // several times or not at all. Clients use /auth/login-staff, which has a
    // slug; this route only remains for old builds (see the telemetry below).
    const candidates = await this.prisma.user.findMany({
      where: { email, deletedAt: null, passwordHash: { not: null } },
      include: { company: { select: { subscriptionStatus: true, subscriptionEndAt: true, lifecycleStatus: true } } },
    });
    const matching = [];
    for (const c of candidates) {
      if (await argon2.verify(c.passwordHash!, password)) matching.push(c);
    }
    if (matching.length === 0) throw new UnauthorizedException('Invalid credentials');
    if (matching.length > 1) {
      // Same email and password in two companies: only the company says which.
      throw new UnauthorizedException({
        message: 'This account exists in more than one company — sign in through your company login',
        code: 'TENANT_REQUIRED',
      });
    }
    const user = matching[0]!;
    if (!user.active) throw new ForbiddenException('Account inactive');
    if (
      user.role !== 'SUPER_ADMIN' &&
      user.role !== 'ADMIN' &&
      user.role !== 'SALES' &&
      user.role !== 'SALES_MANAGER' &&
      user.role !== 'MAINTENANCE_SUPERVISOR' &&
      user.role !== 'BROKER'
    ) {
      throw new ForbiddenException('Email login is for staff and brokers only');
    }
    // SUPER_ADMIN has no company and is always allowed.
    if (user.role !== 'SUPER_ADMIN' && user.company) {
      // Subscription enforcement (billing concern — existing behavior preserved)
      const status = user.company.subscriptionStatus;
      if (status === 'SUSPENDED') {
        throw new ForbiddenException('Your company account has been suspended. Contact your system administrator.');
      }
      if (status === 'CANCELLED') {
        throw new ForbiddenException('Your company subscription has been cancelled. Contact your system administrator.');
      }
      if (status === 'EXPIRED') {
        throw new ForbiddenException('Your company subscription has expired. Contact your system administrator.');
      }
      // MT-034: Lifecycle enforcement (administrative state — new in D2).
      // Distinct from subscriptionStatus: lifecycle is an administrative control;
      // subscription is a billing control. Both must pass at login.
      if (user.company.lifecycleStatus !== 'ACTIVE') {
        throw new ForbiddenException({
          message: 'Company access is currently disabled',
          code: 'COMPANY_NOT_ACTIVE',
        });
      }
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user.id, user.role);
  }

  // MT-035: Called by the controller on every /auth/login hit for telemetry.
  // No-op in terms of business logic; logger.warn surfaces in Datadog/CloudWatch.
  recordLegacyLoginTelemetry(): void {
    this.logger.warn('legacy-login-used: /auth/login called; migrate to /auth/login-staff');
  }

  /**
   * Best-effort merge of synthetic CLIENT peers into the just-resolved user.
   * Swallows errors — a failed merge must NEVER block the login it followed.
   * Surfaces results via Logger so operators can see when the safety net
   * fired without spamming the login response.
   */
  private async tryClaimSyntheticPeers(userId: string, companyId?: string): Promise<void> {
    try {
      // When called from a @PlatformPublic() route the ALS context has
      // companyId=null/bypass=false, which the Prisma middleware rejects for
      // writes on tenanted tables. If the caller supplies the resolved companyId
      // we run the claim inside a proper tenant context so the middleware allows
      // the lead/reservation/etc. updateMany calls.
      const ctx = getTenantContext();
      const needsContext = ctx?.isPlatformPublic && companyId;
      const run = () => claimSyntheticPeers(this.prisma, userId);
      const result = needsContext
        ? await runTenantContext({ companyId: companyId!, bypass: false, isPublic: false }, run)
        : await run();
      if (result.claimedCount > 0) {
        this.logger.log(
          `[identity-claim] merged ${result.claimedCount} synthetic peer(s) into ${userId}: ${result.claimedIds.join(', ')}`,
        );
      }
    } catch (err) {
      // Never let a CRM-housekeeping failure block a customer from logging
      // in. The /me/reservations safety-net OR clause still resolves the
      // visibility question for the request that follows.
      reportFailure(this.logger, 'identity-claim', `[identity-claim] post-login merge errored for ${userId}`, err);
    }
  }

  // ------------- Tokens -------------

  async refresh(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // SES1 — a session ended from another device takes its refresh token with it.
    const session = record.sessionId
      ? await this.prisma.authSession.findUnique({ where: { id: record.sessionId }, select: { id: true, revokedAt: true } })
      : null;
    if (session?.revokedAt) throw new UnauthorizedException('Invalid refresh token');
    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      include: { company: { select: { lifecycleStatus: true, subscriptionStatus: true } } },
    });
    if (!user || !user.active) throw new UnauthorizedException('User inactive');

    // MT-034: Lifecycle enforcement on token refresh.
    // A tenant user whose company is no longer active must not receive a fresh token.
    // SUPER_ADMIN has no company and is always allowed to refresh.
    // Logout (/auth/logout) remains usable even for suspended company users.
    if (user.role !== 'SUPER_ADMIN') {
      if (user.company && !companyAccessAllowed(user.company)) throw companyAccessDenied();
      // Legacy CLIENT/CUSTOMER with null companyId: check DEFAULT_COMPANY_ID company.
      if (!user.company && !user.companyId) {
        const disableFallback = process.env.DISABLE_DEFAULT_COMPANY_FALLBACK === 'true';
        if (!disableFallback && (user.role === 'CLIENT' || user.role === 'CUSTOMER')) {
          const defaultId = process.env.DEFAULT_COMPANY_ID;
          if (defaultId) {
            const defaultCompany = await this.prisma.company.findUnique({
              where: { id: defaultId },
              select: { lifecycleStatus: true, subscriptionStatus: true },
            });
            if (!companyAccessAllowed(defaultCompany)) {
              throw new ForbiddenException({
                message: 'Company access is currently disabled',
                code: 'COMPANY_NOT_ACTIVE',
              });
            }
          }
        }
      }
    }

    // Phase 2 — Layer 2: app-enabled check on refresh (closes sessions when app is disabled).
    // Applies only to users with a company (SUPER_ADMIN and null-companyId legacy users exempt).
    const refreshCompanyId = user.companyId;
    if (refreshCompanyId && user.role !== 'SUPER_ADMIN') {
      const staffRoles: UserRole[] = ['ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR', 'BROKER'];
      if (staffRoles.includes(user.role)) {
        const staffAppEnabled = await this.capabilityService.hasCapability(refreshCompanyId, 'feature.staffApp');
        if (!staffAppEnabled) {
          throw new ForbiddenException({
            message: 'The staff mobile app is not enabled on this account. Your session has expired.',
            code: 'STAFF_APP_NOT_ENABLED',
          });
        }
      } else if (user.role === 'CLIENT' || user.role === 'CUSTOMER') {
        const customerAppEnabled = await this.capabilityService.hasCapability(refreshCompanyId, 'feature.customerApp');
        if (!customerAppEnabled) {
          throw new ForbiddenException({
            message: 'The customer mobile app is not enabled on this account. Your session has expired.',
            code: 'CUSTOMER_APP_NOT_ENABLED',
          });
        }
      }
    }

    // Rotate — the session stays, and remembers when (and from where) it was last used.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    if (session) {
      const meta = currentClientMeta();
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}), ...(meta.userAgent ? { userAgent: meta.userAgent } : {}) },
      });
    }
    return this.issueTokens(user.id, user.role, session?.id);
  }

  async logout(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, select: { sessionId: true } });
    const now = new Date();
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
    if (record?.sessionId) {
      await this.prisma.authSession.updateMany({ where: { id: record.sessionId, revokedAt: null }, data: { revokedAt: now } });
    }
    return { ok: true };
  }

  // ------------- Sessions (SES1 — linked devices) -------------

  /** A session is live while it is not ended and one of its refresh tokens can still renew it. */
  private liveSessions(userId: string): Prisma.AuthSessionWhereInput {
    return { userId, revokedAt: null, refreshTokens: { some: { revokedAt: null, expiresAt: { gt: new Date() } } } };
  }

  async listSessions(userId: string, currentSid: string | null | undefined) {
    const rows = await this.prisma.authSession.findMany({
      where: this.liveSessions(userId),
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true },
    });
    return { data: rows.map((r) => ({ ...r, current: r.id === currentSid })) };
  }

  /** End one of the caller's own sessions: that device is signed out at once. */
  async revokeSession(userId: string, id: string) {
    const ended = await this.endSessions({ userId, id, revokedAt: null });
    if (!ended) throw new NotFoundException('Session not found');
    return { ok: true };
  }

  /** Sign out everywhere but here. */
  async revokeOtherSessions(userId: string, currentSid: string | null | undefined) {
    const ended = await this.endSessions({ userId, revokedAt: null, ...(currentSid ? { id: { not: currentSid } } : {}) });
    // A token minted before sessions existed belongs to no session; it goes too.
    await this.prisma.refreshToken.updateMany({ where: { userId, sessionId: null, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true, ended };
  }

  private async endSessions(where: Prisma.AuthSessionWhereInput): Promise<number> {
    const now = new Date();
    const ids = (await this.prisma.authSession.findMany({ where, select: { id: true } })).map((s) => s.id);
    if (!ids.length) return 0;
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({ where: { id: { in: ids } }, data: { revokedAt: now } }),
      this.prisma.refreshToken.updateMany({ where: { sessionId: { in: ids }, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    return ids.length;
  }

  /**
   * Authenticated self-service password change. Verifies the current password
   * against the stored argon2 hash before writing the new one. Accounts with no
   * password (OTP-only) can't use this path. Existing refresh tokens are
   * revoked so other sessions are forced to re-authenticate after the change.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string, currentSid?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.passwordHash) {
      throw new BadRequestException('No password is set for this account');
    }

    // 400 (not 401): a wrong *current password* in a change-password form is a
    // validation error on the request body, not an authentication failure of
    // the session — keeping it out of the 401 lane avoids tripping the client's
    // session-refresh/logout path.
    const ok = await argon2.verify(user.passwordHash, currentPassword);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    const same = await argon2.verify(user.passwordHash, newPassword);
    if (same) {
      throw new BadRequestException('New password must be different from the current one');
    }

    const passwordHash = await argon2.hash(newPassword);
    const now = new Date();
    // Tokens from before sessions (no sessionId) are other devices too.
    const others = currentSid ? { OR: [{ sessionId: null }, { sessionId: { not: currentSid } }] } : {};
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      // Every other device is signed out; the one that changed it stays in.
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null, ...others },
        data: { revokedAt: now },
      }),
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null, ...(currentSid ? { id: { not: currentSid } } : {}) },
        data: { revokedAt: now },
      }),
    ]);
    return { ok: true };
  }

  // ------------- Forgot / Reset password -------------

  /**
   * Request a password reset. Always returns the same response regardless of
   * whether the email exists — prevents user enumeration. Raw token is sent
   * only in the email link; only the SHA-256 hash is persisted.
   */
  async forgotPassword(rawEmail: string): Promise<{ ok: true }> {
    const email = rawEmail.trim().toLowerCase();
    // Option B — email is unique per company, so this tenant-less route (still
    // used by web-admin and the staff app) can match one account per company.
    // Each gets its own reset link; the token identifies the account, so
    // reset-password needs no change.
    const users = await this.prisma.user.findMany({
      where: { email, deletedAt: null, passwordHash: { not: null } },
      select: { id: true, email: true, passwordHash: true, active: true },
    });
    for (const user of users) await this.issuePasswordReset(user);
    return { ok: true };
  }

  private async issuePasswordReset(user: { id: string; email: string | null; passwordHash: string | null }) {
    // Silently skip an account with no email or no password set.
    if (!user.email || !user.passwordHash) return;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60_000);

    await this.prisma.$transaction([
      // Invalidate all previous active reset tokens for this user so only the
      // latest reset email remains usable.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    // A send failure must never reveal user existence — always return ok: true.
    try {
      await this.email.sendPasswordReset(user.email, rawToken);
    } catch (err: unknown) {
      reportFailure(this.logger, 'auth-email', `password-reset email error`, err, 'error');
    }
  }

  /**
   * Exchange a valid reset token for a new password. Atomically:
   *   1. Marks the token consumed.
   *   2. Updates the password hash.
   *   3. Revokes all existing refresh tokens (forces re-login on all devices).
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<{ ok: true }> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Reset token is invalid or has expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      select: { id: true, passwordHash: true, active: true, emailVerifiedAt: true },
    });
    if (!user || !user.active) throw new BadRequestException('Reset token is invalid or has expired');

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      // The link reached the inbox, so the email is proven too.
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  // ------------- Email verification -------------

  /**
   * Consume a raw verification token and mark the user's email as verified.
   * The user field is set server-side only — the client cannot bypass this.
   *
   * If the token is already consumed, expired, or unknown: throws 400.
   * If the user's email is already verified: returns ok:true with a note.
   */
  async verifyEmail(rawToken: string): Promise<{ ok: true; alreadyVerified?: true }> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const record = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Verification link is invalid or has expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      select: { id: true, emailVerifiedAt: true, active: true, companyId: true },
    });
    if (!user || !user.active) {
      throw new BadRequestException('Verification link is invalid or has expired');
    }

    if (user.emailVerifiedAt) {
      // Consume the token so it cannot be replayed, but don't change state.
      await this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      return { ok: true, alreadyVerified: true };
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      // Invalidate all other outstanding verification tokens for this user.
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: record.userId, consumedAt: null, id: { not: record.id } },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    // The email is proven now: link the CRM records that carry it.
    await this.tryClaimSyntheticPeers(record.userId, user.companyId ?? undefined);
    return { ok: true };
  }

  /**
   * Authenticated resend: issues a new verification token for the calling user's
   * email. Previous tokens are invalidated. Enforces a 60-second per-user
   * cooldown to prevent email flooding.
   *
   * No-ops silently when:
   * - the user has no email (OTP-only account)
   * - the user's email is already verified
   */
  async resendVerification(userId: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true, active: true },
    });
    if (!user || !user.active || !user.email || user.emailVerifiedAt) {
      // Silent no-op: OTP-only accounts, already-verified, or inactive.
      return { ok: true };
    }

    // Cooldown: reject if a token was issued within the last 60 seconds.
    const recent = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - VERIFY_RESEND_COOLDOWN_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new HttpException(
        'Please wait before requesting another verification email',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.sendVerificationEmailSafe(userId, user.email);
    return { ok: true };
  }

  /**
   * Issue a new email verification token and send the verification email.
   * Invalidates all previous tokens for the user first.
   * Errors are swallowed — a send failure must never block registration or resend responses.
   */
  private async sendVerificationEmailSafe(userId: string, email: string): Promise<void> {
    try {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + VERIFY_TTL_MIN * 60_000);

      await this.prisma.$transaction([
        this.prisma.emailVerificationToken.updateMany({
          where: { userId, consumedAt: null },
          data: { consumedAt: new Date() },
        }),
        this.prisma.emailVerificationToken.create({
          data: { userId, tokenHash, expiresAt },
        }),
      ]);

      await this.email.sendEmailVerification(email, rawToken);
    } catch (err) {
      reportFailure(this.logger, 'auth-email', `[email-verify] failed for user ${userId}`, err, 'error');
    }
  }

  /**
   * A sign-in starts a session (the device under «الأجهزة المتصلة»); a refresh
   * passes its session on. The access token names the session, so ending it
   * cuts the device off before the token runs out.
   */
  private async issueTokens(userId: string, role: UserRole, sessionId?: string) {
    if (!sessionId) {
      const meta = currentClientMeta();
      sessionId = (await this.prisma.authSession.create({ data: { userId, userAgent: meta.userAgent, ipAddress: meta.ipAddress }, select: { id: true } })).id;
    }
    const accessToken = await this.jwt.signAsync(
      { sub: userId, role, sid: sessionId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      },
    );

    const refreshRaw = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(refreshRaw).digest('hex');
    const days = this.parseDays(this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt, sessionId },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        fullName: true,
        email: true,
        phone: true,
        locale: true,
        emailVerifiedAt: true,
      },
    });

    return {
      user,
      tokens: {
        accessToken,
        refreshToken: refreshRaw,
        expiresIn: this.parseSeconds(this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m'),
      },
    };
  }

  private parseDays(s: string): number {
    const m = /^(\d+)d$/.exec(s);
    return m && m[1] ? Number(m[1]) : 30;
  }

  private parseSeconds(s: string): number {
    const m = /^(\d+)([smhd])$/.exec(s);
    if (!m || !m[1] || !m[2]) return 900;
    const n = Number(m[1]);
    const u = m[2];
    return n * (u === 's' ? 1 : u === 'm' ? 60 : u === 'h' ? 3600 : 86400);
  }

  // =========================================================================
  // Phase C-Expand — Tenant-aware auth (MT-026 through MT-030)
  // =========================================================================
  // Each method accepts an explicit companyId (resolved from slug by the
  // controller via TenantResolverService). The controller is authoritative for
  // tenant resolution; the service is authoritative for identity operations.
  //
  // EMAIL NORMALIZATION GATE: loginStaff and loginCustomerV2 use canonicalEmail()
  // for the DB lookup (exact match). If stored emails are non-canonical, the login
  // will not find the user. This is intentional — production activation of these
  // endpoints requires MT-020 email normalization to have run first.
  // Gate: ENFORCE_TENANT_SCOPED_AUTH=false (see MT-035).
  // =========================================================================

  // ── MT-026 — Staff login ──────────────────────────────────────────────────

  /**
   * Tenant-scoped staff login. Accepts staff roles only (ADMIN, SALES,
   * SALES_MANAGER, MAINTENANCE_SUPERVISOR, BROKER). SUPER_ADMIN and customer
   * roles are explicitly rejected.
   *
   * @param companyId  Resolved from slug by the controller — never from the client.
   */
  async loginStaff(companyId: string, rawEmail: string, password: string) {
    const email = canonicalEmail(rawEmail);
    if (!email) throw new UnauthorizedException('Invalid credentials');

    const user = await this.prisma.user.findFirst({
      where: { email, companyId, deletedAt: null },
      include: { company: { select: { subscriptionStatus: true, subscriptionEndAt: true, lifecycleStatus: true } } },
    });

    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (!user.active) throw new ForbiddenException('Account inactive');

    const staffRoles: UserRole[] = ['ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR', 'BROKER'];
    if (!staffRoles.includes(user.role)) {
      throw new ForbiddenException('This endpoint is for staff accounts only');
    }

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (user.company) {
      // Subscription enforcement (billing — existing behavior preserved)
      const status = user.company.subscriptionStatus;
      if (status === 'SUSPENDED') throw new ForbiddenException('Company account suspended');
      if (status === 'CANCELLED') throw new ForbiddenException('Company subscription cancelled');
      if (status === 'EXPIRED') throw new ForbiddenException('Company subscription expired');
      // MT-034: Lifecycle enforcement (administrative state — new in D2)
      if (user.company.lifecycleStatus !== 'ACTIVE') {
        throw new ForbiddenException({
          message: 'Company access is currently disabled',
          code: 'COMPANY_NOT_ACTIVE',
        });
      }
    }

    // Phase 2 — Layer 1: staff-app feature gate at login.
    // Uses effective capabilities (plan default → override → column).
    const staffAppEnabled = await this.capabilityService.hasCapability(companyId, 'feature.staffApp');
    if (!staffAppEnabled) {
      throw new ForbiddenException({
        message: 'The staff mobile app is not enabled on this account. Contact your account administrator or upgrade your plan.',
        code: 'STAFF_APP_NOT_ENABLED',
      });
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user.id, user.role);
  }

  // ── MT-027 — Super-admin login ────────────────────────────────────────────

  /**
   * Platform super-admin login. Explicitly requires role=SUPER_ADMIN AND
   * companyId=null so no tenant user can authenticate through this endpoint.
   */
  async loginSuperAdmin(rawEmail: string, password: string) {
    const email = canonicalEmail(rawEmail);
    if (!email) throw new UnauthorizedException('Invalid credentials');

    // Both conditions are required: role AND companyId=null. Defense-in-depth
    // against a case where a tenant admin was incorrectly granted SUPER_ADMIN role.
    const user = await this.prisma.user.findFirst({
      where: { email, role: 'SUPER_ADMIN', companyId: null, deletedAt: null },
    });

    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (!user.active) throw new ForbiddenException('Account inactive');

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user.id, user.role);
  }

  // ── MT-028 — Tenant-aware customer login ──────────────────────────────────

  /**
   * Tenant-scoped customer login. Rejects staff and SUPER_ADMIN accounts.
   * Cross-tenant identity is indistinguishable from a missing account.
   *
   * @param companyId  Resolved from slug — never trusted from the client.
   */
  async loginCustomerV2(companyId: string, rawEmail: string, password: string) {
    const email = canonicalEmail(rawEmail);
    if (!email) throw new UnauthorizedException('Invalid credentials');

    const user = await this.prisma.user.findFirst({
      where: { email, companyId, deletedAt: null },
      include: { company: { select: { lifecycleStatus: true, subscriptionStatus: true } } },
    });

    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (user.role !== 'CLIENT' && user.role !== 'CUSTOMER') {
      // Do not reveal that a staff account exists at this email in this company.
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.active) throw new ForbiddenException('Account inactive');

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // MT-034: Lifecycle enforcement — non-active company cannot issue new sessions.
    if (user.company && !companyAccessAllowed(user.company)) throw companyAccessDenied();

    // Phase 2 — Layer 1: customer-app feature gate at login.
    const customerAppEnabled = await this.capabilityService.hasCapability(companyId, 'feature.customerApp');
    if (!customerAppEnabled) {
      throw new ForbiddenException({
        message: 'The customer mobile app is not enabled on this account. Contact your account administrator.',
        code: 'CUSTOMER_APP_NOT_ENABLED',
      });
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.tryClaimSyntheticPeers(user.id, companyId);
    return this.issueTokens(user.id, user.role);
  }

  // ── MT-029 — Tenant-aware customer registration ───────────────────────────

  /**
   * Tenant-scoped customer registration. companyId comes from the resolved
   * tenant, never from the request body.
   *
   * Option B: User.email and User.phone are unique per company
   * (@@unique([companyId, email]) / ([companyId, phone])). The same person can
   * register with each developer they buy from; each registration is a separate
   * account holding only that developer's data.
   *
   * @param companyId  Resolved from slug — never from request body.
   * @param country    ISO 3166-1 alpha-2 from Company.country — used for phone normalization.
   * @param dto        Registration payload (phone must be E.164 for Phase C).
   */
  async registerCustomerV2(
    companyId: string,
    country: string,
    dto: { fullName: string; phone: string; email: string; password: string },
  ) {
    // MT-034: Lifecycle enforcement — non-active company cannot accept new registrations.
    const registeringCompany = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { lifecycleStatus: true, subscriptionStatus: true },
    });
    if (!companyAccessAllowed(registeringCompany)) throw companyAccessDenied();

    const email = canonicalEmail(dto.email);
    if (!email) throw new BadRequestException('Invalid email address');

    // Accept E.164 directly; also try country hint for non-E.164 format.
    const phone = canonicalPhone(dto.phone) ?? canonicalPhone(dto.phone, country);
    if (!phone) throw new BadRequestException('Invalid phone number — provide a valid E.164 or local format');

    const fullName = dto.fullName.trim();

    // Existence checks scoped to this company; the per-company unique
    // constraints are the final DB-level guarantee.
    // Deleted rows included: the phone and email stay unique per company.
    const [byEmail, byPhone] = await Promise.all([
      this.prisma.user.findFirst({ where: { email, companyId }, select: { id: true } }),
      this.prisma.user.findFirst({ where: { phone, companyId }, select: { id: true } }),
    ]);

    if (byEmail || byPhone) {
      // Someone already holds this phone or email — a registered account or a
      // CRM record (lead / reservation / contract). One answer for all of them,
      // so the form can't be used to learn who is a buyer of this company.
      // Typing them in proves nothing, so registration never takes a record
      // over: the owner proves it instead — a code sent to the phone (OTP
      // sign-in) or a link sent to the email (password reset).
      throw new ConflictException({
        code: 'account_exists_verify',
        message:
          'هذا الرقم أو البريد مسجّل لدينا بالفعل. ادخل برمز يصلك على الموبايل، أو أعد تعيين كلمة المرور من بريدك.',
      });
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { role: 'CLIENT', fullName, email, phone, passwordHash, locale: 'ar', companyId },
    });
    await this.tryClaimSyntheticPeers(user.id, companyId);
    await this.sendVerificationEmailSafe(user.id, email);
    return this.issueTokens(user.id, user.role);
  }

  // ── MT-030 — Tenant-aware OTP ─────────────────────────────────────────────

  /**
   * Tenant-scoped OTP request. Normalises the phone number using the company's
   * country as a hint. Creates OtpCode with companyId.
   *
   * @param companyId  Resolved from slug.
   * @param country    Company.country — used to parse local phone formats.
   * @param rawPhone   Raw phone from client (E.164 or local/national format).
   */
  /**
   * Takes one guess on a code before it is compared, atomically: parallel
   * guesses each take one, so a code is never checked more than
   * OTP_MAX_ATTEMPTS times.
   */
  private async claimOtpAttempt(otpId: string) {
    const claimed = await this.prisma.otpCode.updateMany({
      where: { id: otpId, consumed: false, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) throw new ForbiddenException('Too many attempts; request a new code');
  }

  /** A code signs in once: two requests with the same right code get one session. */
  private async consumeOtp(otpId: string) {
    const used = await this.prisma.otpCode.updateMany({ where: { id: otpId, consumed: false }, data: { consumed: true } });
    if (used.count === 0) throw new BadRequestException('Code expired or not found');
  }

  /** New codes are not new guesses without end: a few per phone per hour. */
  private async assertOtpHourlyCap(phone: string, companyId: string, purpose: string) {
    const sent = await this.prisma.otpCode.count({
      where: { phone, companyId, purpose, createdAt: { gte: new Date(Date.now() - 3600_000) } },
    });
    if (sent >= OTP_MAX_PER_HOUR) {
      throw new HttpException('Too many codes requested — try again in an hour', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /** A suspended, archived or expired company issues no codes and no sessions. */
  private async assertCompanyAccessible(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { lifecycleStatus: true, subscriptionStatus: true },
    });
    if (!companyAccessAllowed(company)) throw companyAccessDenied();
  }

  async requestOtpV2(companyId: string, country: string, rawPhone: string) {
    const phone = canonicalPhone(rawPhone) ?? canonicalPhone(rawPhone, country);
    if (!phone) throw new BadRequestException('Invalid phone number');

    await this.assertCompanyAccessible(companyId);
    // Phase 2: OTP is the customer-app login path; gate before sending SMS cost.
    const customerAppEnabled = await this.capabilityService.hasCapability(companyId, 'feature.customerApp');
    if (!customerAppEnabled) {
      throw new ForbiddenException({
        message: 'The customer mobile app is not enabled on this account.',
        code: 'CUSTOMER_APP_NOT_ENABLED',
      });
    }

    const recent = await this.prisma.otpCode.findFirst({
      where: { phone, companyId, purpose: OTP_LOGIN, createdAt: { gte: new Date(Date.now() - 60_000) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) throw new BadRequestException('Please wait before requesting another code');
    await this.assertOtpHourlyCap(phone, companyId, OTP_LOGIN);

    const code = String(randomInt(100_000, 999_999));
    const codeHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

    await this.prisma.otpCode.create({ data: { phone, codeHash, expiresAt, companyId, purpose: OTP_LOGIN } });
    await this.sms.sendOtp(phone, code);
    return { ok: true };
  }

  // ── U1 — a customer's phone change, proven by a code sent to the new number ──

  /**
   * Start changing the caller's phone: the new number is kept aside
   * (pendingPhone) and gets a code. The account keeps its current number —
   * and an OTP sign-in to the new number does not reach this account — until
   * the code is entered (confirmPhoneChange). A typo therefore never hands
   * the account to whoever holds the mistyped number.
   */
  async requestPhoneChange(userId: string, rawPhone: string) {
    const companyId = getRequiredCompanyId();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
      select: { id: true, phone: true },
    });
    if (!user) throw new UnauthorizedException('Invalid session');
    const phone = await phoneForWrite(this.prisma, rawPhone, companyId);
    if (!phone) throw new BadRequestException('Invalid phone number');
    if (phone === user.phone) throw new BadRequestException('هذا هو رقمك الحالي');
    // Taken by another account of the company (a CRM record included).
    const taken = await this.prisma.user.findFirst({ where: { companyId, phone, id: { not: userId } }, select: { id: true } });
    if (taken) throw new ConflictException('هذا الرقم مستخدم في حساب آخر — تواصل مع الشركة');
    const recent = await this.prisma.otpCode.findFirst({
      where: { phone, companyId, purpose: OTP_PHONE_CHANGE, createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent) throw new BadRequestException('Please wait before requesting another code');
    await this.assertOtpHourlyCap(phone, companyId, OTP_PHONE_CHANGE);

    const code = String(randomInt(100_000, 999_999));
    const codeHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);
    await this.prisma.user.update({ where: { id: userId }, data: { pendingPhone: phone } });
    await this.prisma.otpCode.create({ data: { phone, codeHash, expiresAt, companyId, purpose: OTP_PHONE_CHANGE } });
    await this.sms.sendOtp(phone, code);
    return { ok: true, pendingPhone: phone };
  }

  /** The code sent to the new number: the phone changes now, verified. */
  async confirmPhoneChange(userId: string, code: string) {
    const companyId = getRequiredCompanyId();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
      select: { id: true, pendingPhone: true },
    });
    if (!user) throw new UnauthorizedException('Invalid session');
    if (!user.pendingPhone) throw new BadRequestException('لا يوجد تغيير رقم قيد التأكيد');
    const phone = user.pendingPhone;
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, companyId, purpose: OTP_PHONE_CHANGE, consumed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Code expired or not found');
    await this.claimOtpAttempt(otp.id);
    if (createHash('sha256').update(code).digest('hex') !== otp.codeHash) {
      throw new BadRequestException('Invalid code');
    }
    await this.consumeOtp(otp.id);
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { phone, phoneVerifiedAt: new Date(), pendingPhone: null },
      });
    } catch (e) {
      // Taken by another account since the code was sent.
      if (isUniqueConflictOn(e, 'phone')) throw new ConflictException('هذا الرقم مستخدم في حساب آخر — تواصل مع الشركة');
      throw e;
    }
    // The number is proven: the account may now link the CRM records that carry it.
    await this.tryClaimSyntheticPeers(userId, companyId);
    return { ok: true, phone };
  }

  /**
   * Tenant-scoped OTP verification. Verifies the code only within the resolved
   * company — an OTP issued for Company A cannot be consumed by Company B.
   *
   * Legacy OTP cutover strategy (Option A): new OTPs are written with companyId.
   * Legacy null-companyId OTPs expire after OTP_TTL_MIN (10 min). Once the
   * ENFORCE_TENANT_SCOPED_AUTH flag is enabled in production, all outstanding
   * legacy OTPs will have expired and verification is strictly company-scoped.
   */
  async verifyOtpV2(
    companyId: string,
    country: string,
    rawPhone: string,
    code: string,
    fullName?: string,
  ) {
    const phone = canonicalPhone(rawPhone) ?? canonicalPhone(rawPhone, country);
    if (!phone) throw new BadRequestException('Invalid phone number');

    await this.assertCompanyAccessible(companyId);
    // Phase 2: gate before consuming the OTP code.
    const customerAppEnabled = await this.capabilityService.hasCapability(companyId, 'feature.customerApp');
    if (!customerAppEnabled) {
      throw new ForbiddenException({
        message: 'The customer mobile app is not enabled on this account.',
        code: 'CUSTOMER_APP_NOT_ENABLED',
      });
    }

    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, companyId, purpose: OTP_LOGIN, consumed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Code expired or not found');
    await this.claimOtpAttempt(otp.id);

    const codeHash = createHash('sha256').update(code).digest('hex');
    if (codeHash !== otp.codeHash) {
      throw new UnauthorizedException('Invalid code');
    }
    await this.consumeOtp(otp.id);

    // The code proves the phone: record it, so the account may link to the
    // CRM records that carry this number.
    const now = new Date();
    // Deleted rows included: the phone stays unique per company, so a removed
    // customer must get "inactive", not a failed insert.
    let user = await this.prisma.user.findFirst({ where: { phone, companyId } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { phone, fullName: fullName ?? 'New User', role: 'CLIENT', locale: 'ar', companyId, phoneVerifiedAt: now },
      });
    } else {
      // This is the customer sign-in: a staff account at this number gets no
      // session here — a phone code alone must never open the staff side.
      if (user.role !== 'CLIENT' && user.role !== 'CUSTOMER') throw new UnauthorizedException('Invalid code');
      // A deactivated account gets no session — and no CRM claim — by OTP either.
      if (user.deletedAt || user.active === false) throw new ForbiddenException('Account inactive');
      await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now, phoneVerifiedAt: now } });
    }
    await this.tryClaimSyntheticPeers(user.id, companyId);
    return this.issueTokens(user.id, user.role);
  }

  // ── MT-030 — Tenant-aware forgot/reset password ───────────────────────────

  /**
   * Tenant-scoped forgot-password initiation. Looks up the user within the
   * company only. Enumeration-safe: always returns ok:true.
   */
  async forgotPasswordV2(companyId: string, rawEmail: string): Promise<{ ok: true }> {
    const email = canonicalEmail(rawEmail);
    if (!email) return { ok: true };

    const user = await this.prisma.user.findFirst({
      where: { email, companyId, deletedAt: null },
      select: { id: true, email: true, passwordHash: true, active: true, role: true },
    });
    // A CRM-only CLIENT (no password yet) is claimed this way: the reset link
    // goes to the email on file, so only its owner can set the password.
    if (!user || !user.email || !user.active) return { ok: true };
    if (!user.passwordHash && user.role !== 'CLIENT') return { ok: true };

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60_000);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    try {
      await this.email.sendPasswordReset(user.email, rawToken);
    } catch (err: unknown) {
      reportFailure(this.logger, 'auth-email', `password-reset email error`, err, 'error');
    }
    return { ok: true };
  }

  // resetPasswordV2: opaque token → user; no slug needed (token identifies the user).
  // Falls through to the existing resetPassword() method.
}
