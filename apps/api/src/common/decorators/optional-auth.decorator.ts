import { SetMetadata } from '@nestjs/common';

/**
 * Mark a route as **optionally authenticated**: the route stays publicly
 * callable (no auth required), but if a valid Bearer token is supplied,
 * `req.user` is populated and `@CurrentUser()` returns the decoded payload.
 *
 * Used by public endpoints that want to attribute submissions to the
 * authenticated user when the caller happens to be logged in — most
 * importantly `/public/visit-request` and `/public/info-request`, where a
 * cookie / browser race could otherwise leave a row orphaned with
 * `userId=null` even though the visitor was signed in.
 *
 * Pair with `@Public()` on the handler:
 *
 * ```ts
 * @Public()
 * @OptionalAuth()
 * @Post('public/visit-request')
 * publicVisit(@CurrentUser() user: AuthUser | null, @Body() dto: …) { … }
 * ```
 *
 * The guard logic lives in `JwtAuthGuard`: when this metadata is present on
 * the handler it runs the passport-jwt strategy but tolerates a missing or
 * invalid token (no `UnauthorizedException`).
 */
export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
