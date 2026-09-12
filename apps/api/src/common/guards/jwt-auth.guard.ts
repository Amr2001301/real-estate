import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { IS_PLATFORM_PUBLIC_KEY } from '../decorators/platform-public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // MT-024: @PlatformPublic routes also skip JWT authentication.
    const isPlatformPublic = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isOptional = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );
    // Public + optional: still run the passport-jwt strategy so a valid Bearer
    // populates `req.user` (and `@CurrentUser()` returns it); missing/invalid
    // tokens are tolerated below in handleRequest.
    if ((isPublic && !isOptional) || isPlatformPublic) return true;
    if (isOptional) {
      // Cache so handleRequest can decide whether to throw.
      const request = context.switchToHttp().getRequest<{ _isOptionalAuth?: boolean }>();
      request._isOptionalAuth = true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser, _info: unknown, context?: ExecutionContext): TUser {
    // Optional-auth routes never throw on missing/invalid token: they just
    // get `null` for the user. The decorator (`@CurrentUser()`) treats that
    // as anonymous.
    if (context) {
      const request = context.switchToHttp().getRequest<{ _isOptionalAuth?: boolean }>();
      if (request._isOptionalAuth) return (user ?? null) as TUser;
    }
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    return user;
  }
}
