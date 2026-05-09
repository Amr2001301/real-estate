import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export interface AuthUser {
  sub: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
