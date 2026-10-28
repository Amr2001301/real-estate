import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  hashRecoveryCode,
  newRecoveryCodes,
  newTotpSecret,
  openSecret,
  otpauthUrl,
  sealSecret,
  verifyTotp,
} from '../../common/security/totp';

/** Who may turn on two-step sign-in: everyone who signs in with a password. */
const TWO_FACTOR_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALES', 'MAINTENANCE_SUPERVISOR', 'BROKER'];
/** A company can require it of its admins, or of all its own staff (brokers are outside firms). */
export const REQUIRE_2FA_KEY = 'security.require2fa';
export type TwoFactorPolicy = 'OFF' | 'ADMINS' | 'STAFF';
const POLICY_ROLES: Record<TwoFactorPolicy, UserRole[]> = {
  OFF: [],
  ADMINS: ['ADMIN'],
  STAFF: ['ADMIN', 'SALES_MANAGER', 'SALES', 'MAINTENANCE_SUPERVISOR'],
};
const CHALLENGE_TTL = '5m';
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

export type ChallengePurpose = 'verify' | 'setup';
interface ChallengePayload {
  sub: string;
  typ: '2fa';
  purpose: ChallengePurpose;
}

/**
 * TFA1 — two-step sign-in with an authenticator app. After the password, a
 * user with it on gets a short-lived challenge instead of tokens and trades
 * it, with a 6-digit code (or a recovery code), for a session. A user whose
 * company requires it but who has not set it up gets a setup challenge.
 */
@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** The secret is sealed with its own key when one is set, else one derived from the refresh secret. */
  private material(): string {
    return this.config.get<string>('TOTP_ENCRYPTION_KEY') || `totp:${this.config.getOrThrow<string>('JWT_REFRESH_SECRET')}`;
  }

  /** Challenges are signed with a key access tokens never use, so one can never pass as the other. */
  private challengeSecret(): string {
    return `${this.config.getOrThrow<string>('JWT_ACCESS_SECRET')}:2fa-challenge`;
  }

  // ── Policy ────────────────────────────────────────────────────────────────

  async policy(companyId: string | null): Promise<TwoFactorPolicy> {
    if (!companyId) return 'OFF';
    const row = await this.prisma.setting.findFirst({ where: { companyId, key: REQUIRE_2FA_KEY }, select: { value: true } });
    return row?.value === 'ADMINS' || row?.value === 'STAFF' ? row.value : 'OFF';
  }

  async setPolicy(companyId: string, mode: TwoFactorPolicy): Promise<{ mode: TwoFactorPolicy }> {
    await this.prisma.setting.upsert({
      where: { companyId_key: { companyId, key: REQUIRE_2FA_KEY } },
      create: { companyId, key: REQUIRE_2FA_KEY, value: mode },
      update: { value: mode },
    });
    return { mode };
  }

  async requiredFor(user: { role: UserRole; companyId: string | null }): Promise<boolean> {
    return POLICY_ROLES[await this.policy(user.companyId)].includes(user.role);
  }

  // ── Sign-in challenge ─────────────────────────────────────────────────────

  /**
   * What a correct password leads to: tokens (null here), a code step, or a
   * setup step when the company requires it and it is not on yet.
   */
  async signInStep(user: { id: string; role: UserRole; companyId: string | null; totpEnabledAt: Date | null }) {
    if (!TWO_FACTOR_ROLES.includes(user.role)) return null;
    if (user.totpEnabledAt) return { twoFactorRequired: true as const, challenge: await this.challenge(user.id, 'verify') };
    if (await this.requiredFor(user)) return { twoFactorSetupRequired: true as const, challenge: await this.challenge(user.id, 'setup') };
    return null;
  }

  private challenge(sub: string, purpose: ChallengePurpose): Promise<string> {
    const payload: ChallengePayload = { sub, typ: '2fa', purpose };
    return this.jwt.signAsync(payload, { secret: this.challengeSecret(), expiresIn: CHALLENGE_TTL });
  }

  /** The user a challenge names, if it is genuine, unexpired and for this step. */
  async readChallenge(token: string, purpose: ChallengePurpose): Promise<string> {
    let p: ChallengePayload;
    try {
      p = await this.jwt.verifyAsync<ChallengePayload>(token, { secret: this.challengeSecret() });
    } catch {
      throw new UnauthorizedException({ message: 'The sign-in step expired — sign in again', code: 'CHALLENGE_EXPIRED' });
    }
    if (p.typ !== '2fa' || p.purpose !== purpose) throw new UnauthorizedException('Invalid challenge');
    return p.sub;
  }

  // ── Checking a code ───────────────────────────────────────────────────────

  /**
   * A 6-digit code from the app, or one of the recovery codes (used up).
   * Five wrong in a row lock the step for 15 minutes.
   */
  async checkCode(userId: string, code: string): Promise<{ recovery: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabledAt: true, totpLastStep: true, totpRecoveryHashes: true, totpFailures: true, totpLockedUntil: true },
    });
    if (!user?.totpSecret || !user.totpEnabledAt) throw new BadRequestException('Two-step sign-in is not on');
    if (user.totpLockedUntil && user.totpLockedUntil > new Date()) {
      throw new HttpException({ message: 'Too many wrong codes — try again in 15 minutes', code: 'TWO_FACTOR_LOCKED' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const clean = code.trim();
    const step = verifyTotp(openSecret(user.totpSecret, this.material()), clean.replace(/\s+/g, ''), user.totpLastStep);
    if (step !== null) {
      // Conditional on the last step, so the same code raced twice wins once.
      const won = await this.prisma.user.updateMany({
        where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
        data: { totpLastStep: step, totpFailures: 0, totpLockedUntil: null },
      });
      if (won.count === 1) return { recovery: false };
    } else {
      const hash = hashRecoveryCode(clean);
      if (user.totpRecoveryHashes.includes(hash)) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { totpRecoveryHashes: user.totpRecoveryHashes.filter((h) => h !== hash), totpFailures: 0, totpLockedUntil: null },
        });
        return { recovery: true };
      }
    }
    const failures = user.totpFailures + 1;
    await this.prisma.user.update({
      where: { id: userId },
      data: failures >= MAX_FAILURES ? { totpFailures: 0, totpLockedUntil: new Date(Date.now() + LOCK_MS) } : { totpFailures: failures },
    });
    throw new UnauthorizedException({ message: 'Wrong code', code: 'TWO_FACTOR_INVALID' });
  }

  // ── Turning it on and off (own account) ───────────────────────────────────

  async status(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, companyId: true, totpEnabledAt: true, totpRecoveryHashes: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      available: TWO_FACTOR_ROLES.includes(user.role),
      enabled: !!user.totpEnabledAt,
      enabledAt: user.totpEnabledAt,
      recoveryCodesLeft: user.totpEnabledAt ? user.totpRecoveryHashes.length : 0,
      required: await this.requiredFor(user),
    };
  }

  /** A new secret to scan; it takes effect once a code from it is entered. */
  async setup(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true, phone: true, totpEnabledAt: true, company: { select: { name: true } } },
    });
    if (!user || !TWO_FACTOR_ROLES.includes(user.role)) throw new ForbiddenException('Two-step sign-in is for staff accounts');
    if (user.totpEnabledAt) throw new BadRequestException('Two-step sign-in is already on');
    const secret = newTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: sealSecret(secret, this.material()), totpLastStep: null } });
    const issuer = user.company?.name?.trim() || 'Devora';
    return { secret, otpauthUrl: otpauthUrl(secret, user.email ?? user.phone ?? userId, issuer) };
  }

  /** Confirm with a code from the app: it is on, and here are the recovery codes (shown once). */
  async enable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { totpSecret: true, totpEnabledAt: true } });
    if (!user?.totpSecret) throw new BadRequestException('Start the setup first');
    if (user.totpEnabledAt) throw new BadRequestException('Two-step sign-in is already on');
    const step = verifyTotp(openSecret(user.totpSecret, this.material()), code.replace(/\s+/g, ''), null);
    if (step === null) throw new BadRequestException({ message: 'Wrong code — check the time on your phone and try again', code: 'TWO_FACTOR_INVALID' });
    const recoveryCodes = newRecoveryCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabledAt: new Date(),
        totpLastStep: step,
        totpRecoveryHashes: recoveryCodes.map(hashRecoveryCode),
        totpFailures: 0,
        totpLockedUntil: null,
      },
    });
    return { enabled: true, recoveryCodes };
  }

  /** Off again: the password and a code, and only where the company does not require it. */
  async disable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, companyId: true, passwordHash: true, totpEnabledAt: true },
    });
    if (!user?.totpEnabledAt) throw new BadRequestException('Two-step sign-in is not on');
    if (await this.requiredFor(user)) throw new ForbiddenException({ message: 'Your company requires two-step sign-in', code: 'TWO_FACTOR_REQUIRED' });
    if (!user.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      throw new BadRequestException('Current password is incorrect');
    }
    await this.checkCode(userId, code);
    await this.clear(userId);
    return { enabled: false };
  }

  async regenerateRecoveryCodes(userId: string, code: string) {
    await this.checkCode(userId, code);
    const recoveryCodes = newRecoveryCodes();
    await this.prisma.user.update({ where: { id: userId }, data: { totpRecoveryHashes: recoveryCodes.map(hashRecoveryCode) } });
    return { recoveryCodes };
  }

  /** Back to password only (the admin's reset for a lost phone, or turning it off). */
  async clear(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpRecoveryHashes: [], totpFailures: 0, totpLockedUntil: null },
    });
  }
}
