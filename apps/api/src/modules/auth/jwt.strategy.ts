import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { runAsPlatform } from '../../common/tenant/tenant-context';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: { sub: string; sid?: string; typ?: string }): Promise<AuthUser> {
    // TFA1 — a sign-in challenge is signed with another key, but is never a session either way.
    if (payload.typ) throw new UnauthorizedException('Not an access token');
    // Runs before TenantContextInterceptor, and the account's company is what
    // this lookup establishes — so it cannot be tenant-scoped. The signed sub
    // identifies exactly one row.
    const user = await runAsPlatform(() =>
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          role: true,
          email: true,
          phone: true,
          active: true,
          companyId: true,
          // SES1 — a session ended from another device stops this token now, not when it expires.
          ...(payload.sid ? { authSessions: { where: { id: payload.sid }, select: { revokedAt: true } } } : {}),
        },
      }),
    );
    if (!user || !user.active) throw new UnauthorizedException('Invalid or inactive user');
    if (payload.sid) {
      const session = (user as { authSessions?: Array<{ revokedAt: Date | null }> }).authSessions?.[0];
      if (!session || session.revokedAt) throw new UnauthorizedException('Session ended');
    }
    return {
      sub: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
      companyId: user.companyId,
      sid: payload.sid ?? null,
    };
  }
}
