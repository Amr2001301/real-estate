import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export interface AuthUser {
  sub: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  /** SES1 — the session (device) the access token was issued to; absent on tokens from before sessions. */
  sid?: string | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
