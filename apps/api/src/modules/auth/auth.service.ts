import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getTenantContext } from '../../common/tenant/tenant-context';
import { claimSyntheticPeers } from '../../common/utils/identity-claim';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import type { UserRole } from '@prisma/client';

const OTP_TTL_MIN = 10;
const OTP_MAX_ATTEMPTS = 5;
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
  ) {}

  // ------------- Email + password (Admin / Sales / Broker) -------------

  async loginEmail(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (!user.active) throw new ForbiddenException('Account inactive');
    if (
      user.role !== 'ADMIN' &&
      user.role !== 'SALES' &&
      user.role !== 'SALES_MANAGER' &&
      user.role !== 'MAINTENANCE_SUPERVISOR' &&
      user.role !== 'BROKER'
    ) {
      throw new ForbiddenException('Email login is for staff and brokers only');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user.id, user.role);
  }

  // ------------- Email + password (Public customer) -------------

  /**
   * Public customer registration. Role is forced to CLIENT server-side (the
   * same role the OTP/lead flows use) — the payload can never choose a role, so
   * self-escalation is impossible. Optional preference fields are accepted but
   * not yet persisted (no CustomerProfile store).
   */
  async registerCustomer(dto: {
    fullName: string;
    phone: string;
    email: string;
    password: string;
  }) {
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();
    const fullName = dto.fullName.trim();

    const [byEmail, byPhone] = await Promise.all([
      this.prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true, passwordHash: true, phone: true, companyId: true },
      }),
      this.prisma.user.findUnique({
        where: { phone },
        select: { id: true, role: true, passwordHash: true, email: true, companyId: true },
      }),
    ]);

    // P8 — Synthetic-User claim. When a customer signs up with credentials that
    // match an EXISTING CLIENT row created by the lead/visit-request flow (i.e.
    // a synthetic User with no passwordHash, never logged in), claim that row
    // instead of throwing a conflict. This preserves the link to every Lead /
    // Reservation / VisitRequest already pointing at that row — without it the
    // customer would register as a fresh User and never see records that the
    // sales team already attached to their CRM identity.
    //
    // Claim conditions (strict): role=CLIENT, passwordHash=null, and the row
    // matched on either phone or email. A row with passwordHash set is a real
    // account → conflict (genuine duplicate). A staff/broker row matched by
    // typo is also a conflict.
    const matchedRow = byEmail ?? byPhone;
    if (matchedRow) {
      const isSynthetic =
        matchedRow.role === 'CLIENT' && matchedRow.passwordHash === null;
      if (!isSynthetic) {
        if (byEmail) throw new ConflictException({ code: 'email_taken' });
        if (byPhone) throw new ConflictException({ code: 'phone_taken' });
      }
      // Both email AND phone matched, but to two DIFFERENT synthetic rows.
      // Don't silently merge those — that's an admin/CRM data conflict and
      // requires manual cleanup. Fail loudly so we never lose history.
      if (byEmail && byPhone && byEmail.id !== byPhone.id) {
        throw new ConflictException({ code: 'identity_split_synthetic' });
      }
      // Safe to claim. Update credentials + canonical contact fields; existing
      // FK rows (Lead.clientId, Reservation.clientId, …) continue to resolve.
      const passwordHash = await argon2.hash(dto.password);
      // Preserve existing companyId from the synthetic row (it was set by the
      // staff/lead flow when the row was first created). Fall back to the active
      // tenant context companyId (set by the interceptor from DEFAULT_COMPANY_ID
      // for public routes) for legacy rows that pre-date the MT migration.
      const claimCompanyId = matchedRow.companyId ?? (getTenantContext()?.companyId ?? null);
      const claimed = await this.prisma.user.update({
        where: { id: matchedRow.id },
        // Claiming a synthetic row: clear emailVerifiedAt because the email may
        // have changed (synthetic rows can have stale or null emails).
        data: { fullName, email, phone, passwordHash, locale: 'ar', emailVerifiedAt: null, companyId: claimCompanyId },
      });
      // P9 — sweep any OTHER synthetic peers (e.g. one matched by phone
      // here, another that holds an email-only stub) that the in-place
      // claim above didn't touch.
      await this.tryClaimSyntheticPeers(claimed.id);
      // Send verification email for the claimed email address.
      await this.sendVerificationEmailSafe(claimed.id, email);
      return this.issueTokens(claimed.id, claimed.role);
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        role: 'CLIENT',
        fullName,
        email,
        phone,
        passwordHash,
        locale: 'ar',
        companyId: getTenantContext()?.companyId ?? null,
      },
    });
    await this.tryClaimSyntheticPeers(user.id);
    // Send verification email after successful registration (best-effort — a
    // delivery failure must never block the registration itself).
    await this.sendVerificationEmailSafe(user.id, email);
    return this.issueTokens(user.id, user.role);
  }

  /**
   * Public customer login. Accepts only CLIENT/CUSTOMER accounts — staff and
   * brokers are rejected here even with valid credentials, keeping the public
   * surface isolated from the staff login gate.
   */
  async loginCustomer(rawEmail: string, password: string) {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (user.role !== 'CLIENT' && user.role !== 'CUSTOMER') {
      throw new ForbiddenException({ code: 'not_customer' });
    }
    if (!user.active) throw new ForbiddenException('Account inactive');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    // P9 — opportunistic synthetic-peer claim. If a CRM-only stub exists for
    // this customer (a Lead-side row created by findOrCreateClient before
    // they registered) and shares phone / email, fold its FK references
    // into the real account so /me/reservations etc. resolve correctly.
    await this.tryClaimSyntheticPeers(user.id);
    return this.issueTokens(user.id, user.role);
  }

  // ------------- Phone OTP (Client / Customer) -------------

  async requestOtp(phone: string) {
    // Rate-limit window: max 1 OTP per phone per 60s
    const recent = await this.prisma.otpCode.findFirst({
      where: { phone, createdAt: { gte: new Date(Date.now() - 60_000) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) throw new BadRequestException('Please wait before requesting another code');

    const code = String(randomInt(100_000, 999_999));
    const codeHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

    await this.prisma.otpCode.create({ data: { phone, codeHash, expiresAt } });
    await this.sms.sendOtp(phone, code);
    return { ok: true };
  }

  async verifyOtp(phone: string, code: string, fullName?: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Code expired or not found');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new ForbiddenException('Too many attempts; request a new code');
    }
    const codeHash = createHash('sha256').update(code).digest('hex');
    if (codeHash !== otp.codeHash) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid code');
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          fullName: fullName ?? 'New User',
          role: 'CLIENT',
          locale: 'ar',
          companyId: getTenantContext()?.companyId ?? null,
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }
    // P9 — same opportunistic claim as the password path. Useful when an
    // OTP customer has an *email* somewhere in the CRM that doesn't match
    // their phone-anchored row.
    await this.tryClaimSyntheticPeers(user.id);
    return this.issueTokens(user.id, user.role);
  }

  /**
   * Best-effort merge of synthetic CLIENT peers into the just-resolved user.
   * Swallows errors — a failed merge must NEVER block the login it followed.
   * Surfaces results via Logger so operators can see when the safety net
   * fired without spamming the login response.
   */
  private async tryClaimSyntheticPeers(userId: string): Promise<void> {
    try {
      const result = await claimSyntheticPeers(this.prisma, userId);
      if (result.claimedCount > 0) {
        this.logger.log(
          `[identity-claim] merged ${result.claimedCount} synthetic peer(s) into ${userId}: ${result.claimedIds.join(', ')}`,
        );
      }
    } catch (err) {
      // Never let a CRM-housekeeping failure block a customer from logging
      // in. The /me/reservations safety-net OR clause still resolves the
      // visibility question for the request that follows.
      this.logger.warn(
        `[identity-claim] post-login merge errored for ${userId}: ${(err as Error).message}`,
      );
    }
  }

  // ------------- Tokens -------------

  async refresh(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || !user.active) throw new UnauthorizedException('User inactive');

    // Rotate
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(user.id, user.role);
  }

  async logout(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  /**
   * Authenticated self-service password change. Verifies the current password
   * against the stored argon2 hash before writing the new one. Accounts with no
   * password (OTP-only) can't use this path. Existing refresh tokens are
   * revoked so other sessions are forced to re-authenticate after the change.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
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
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      // Invalidate other sessions: any active refresh token is revoked.
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
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
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, active: true },
    });

    // Silently return if the account doesn't exist or has no password set.
    if (!user || !user.email || !user.passwordHash) return { ok: true };

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
      this.logger.error(`password-reset email error: ${(err as Error).message}`);
    }

    return { ok: true };
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
      select: { id: true, passwordHash: true, active: true },
    });
    if (!user || !user.active) throw new BadRequestException('Reset token is invalid or has expired');

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
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
      select: { id: true, emailVerifiedAt: true, active: true },
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
      this.logger.error(`[email-verify] failed for user ${userId}: ${(err as Error).message}`);
    }
  }

  private async issueTokens(userId: string, role: UserRole) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, role },
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
      data: { userId, tokenHash, expiresAt },
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
}
