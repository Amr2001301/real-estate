import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SmsService } from './sms.service';
import type { UserRole } from '@prisma/client';

const OTP_TTL_MIN = 10;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sms: SmsService,
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
        data: { phone, fullName: fullName ?? 'New User', role: 'CLIENT', locale: 'ar' },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }
    return this.issueTokens(user.id, user.role);
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
