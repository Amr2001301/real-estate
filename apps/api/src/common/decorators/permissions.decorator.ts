import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export interface PermissionsMeta {
  /** OR semantics — any one of these codes grants access. */
  codes: string[];
  /**
   * Whether `role === ADMIN` bypasses the permission check.
   * Default: true (matches the project's super-admin posture).
   * Use {@link PermissionsStrict} to opt out for two-person actions.
   */
  adminBypass: boolean;
}

/**
 * Require ANY of the listed permission codes. ADMIN role bypasses the check.
 *
 * Stack on top of `@Roles(...)` for cleanest reads — `@Roles(ADMIN)` continues
 * to gate the route at the coarse level; this decorator narrows further for
 * non-admin roles, and (when ADMIN bypass is removed later) for scoped admins.
 */
export const Permissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, { codes, adminBypass: true } satisfies PermissionsMeta);

/**
 * Same as {@link Permissions} but ADMIN must hold the code explicitly. Use for
 * actions where the org wants segregation of duties (e.g. `deposits:verify`,
 * `broker_payouts:approve`).
 */
export const PermissionsStrict = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, { codes, adminBypass: false } satisfies PermissionsMeta);
