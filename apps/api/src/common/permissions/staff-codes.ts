import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Permissions that open pages (PRM). A permission code is what opens a page
 * to a staff member; their role is only the set of codes they start with.
 *
 * Staff are the company's own people. Customers and brokers keep their own
 * apps and portal and are never opened anything by a code.
 */
export const STAFF_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.SALES_MANAGER,
  UserRole.SALES,
  UserRole.MAINTENANCE_SUPERVISOR,
];

/**
 * Codes that stay with the company's admins even when ticked for someone
 * else: whoever holds them could grant themselves everything, or read and
 * change the whole company's people, settings and history. A non-admin is
 * never given one (PATCH users/:id/permissions refuses it) and one held from
 * before never counts (the guards ignore it). Data export and import are
 * ADMIN-only routes with no code, so they stay with admins too.
 */
const ADMIN_ONLY_CODES: ReadonlySet<string> = new Set([
  'permissions:manage',
  'settings:read',
  'settings:write',
  'company_branding:manage',
  'audit:read',
]);

export function isAdminOnlyCode(code: string): boolean {
  return code.startsWith('users:') || ADMIN_ONLY_CODES.has(code);
}

/** The codes that count for a user: an admin's all; anyone else's minus the admin-only ones. */
export function effectiveCodes(role: UserRole | undefined, held: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const code of held) if (role === UserRole.ADMIN || !isAdminOnlyCode(code)) out.add(code);
  return out;
}

/** Request slot the guards share: the caller's codes, loaded once per request. */
export interface ReqWithCodes {
  user?: { sub?: string; role?: UserRole };
  _userPermissions?: Set<string>;
  /** Set when a code (not the role) let the caller in — see @GrantedBy. */
  _grantedBy?: string;
}

/** The caller's held codes, loaded at most once per request. */
export async function loadHeldCodes(
  prisma: PrismaService,
  req: ReqWithCodes,
  userId: string,
): Promise<Set<string>> {
  if (req._userPermissions) return req._userPermissions;
  const rows = await prisma.userPermission.findMany({
    where: { userId },
    select: { permission: { select: { code: true } } },
  });
  req._userPermissions = new Set(rows.map((r) => r.permission.code));
  return req._userPermissions;
}
