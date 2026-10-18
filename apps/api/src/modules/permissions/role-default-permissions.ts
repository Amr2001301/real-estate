import { Prisma, PrismaClient, UserRole } from '@prisma/client';

/**
 * The permission codes a staff member starts with, by role. The guards ask
 * for codes, not roles, so a user created with none could open every page
 * and do nothing on it ("ليست لديك الصلاحية المطلوبة") until an admin ticked
 * ~30 boxes by hand. New users now get their role's tier on creation; the
 * admin still adds or removes codes per person afterwards.
 */

/**
 * SALES: the read + CRM-workflow tier only. No strict financial/admin action
 * (approve/reject/sign/verify/pay, plan/project/unit changes, users,
 * permissions, settings).
 */
export const SALES_DEFAULT_PERMISSIONS = [
  // CRM
  'leads:read',
  'leads:create',
  'leads:update',
  'leads:note',
  'leads:assign',
  'leads:advance-stage',
  // Visits
  'visits:read',
  'visits:create',
  'visits:schedule',
  'visits:confirm',
  'visits:complete',
  'visits:reschedule',
  'visits:cancel',
  'visits:no-show',
  // Reservations (create/read/update only — strict transitions stay admin)
  'reservations:read',
  'reservations:create',
  'reservations:update',
  // Contracts (read only)
  'contracts:read',
  // Inventory / read-only references
  'projects:read',
  'units:read',
  'installments:read',
  'deposits:read',
  // Compensation self-read (API self-scopes SALES to their own rows)
  'bonus:entries:read',
  'targets:read',
  // Broker-attributed read surfaces SALES routes already allow
  'broker_leads:read',
  'broker_contracts:read',
  'broker_reservations:read',
];

/**
 * SALES_MANAGER: the sales tier plus team targets. Sales/operational reports
 * aggregate all sales data, not the team's, so they stay ADMIN-only.
 */
export const SALES_MANAGER_DEFAULT_PERMISSIONS = [...SALES_DEFAULT_PERMISSIONS, 'targets:manage'];

/** Mobile-only staff: read maintenance and drive its status. */
export const MAINTENANCE_SUPERVISOR_DEFAULT_PERMISSIONS = [
  'maintenance:read',
  'maintenance:resolve',
];

/**
 * The codes a role starts with; `'ALL'` for an admin, who can grant
 * themselves any code anyway and holds the strict ones (cancel a contract,
 * verify payments, approve a discount) that nobody else would otherwise have.
 */
export function roleDefaultPermissions(role: UserRole): readonly string[] | 'ALL' {
  switch (role) {
    case UserRole.ADMIN:
      return 'ALL';
    case UserRole.SALES_MANAGER:
      return SALES_MANAGER_DEFAULT_PERMISSIONS;
    case UserRole.SALES:
      return SALES_DEFAULT_PERMISSIONS;
    case UserRole.MAINTENANCE_SUPERVISOR:
      return MAINTENANCE_SUPERVISOR_DEFAULT_PERMISSIONS;
    default:
      return [];
  }
}

/** Grants `role`'s starting codes to the user (codes missing from the catalog are skipped). */
export async function grantRoleDefaultPermissions(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
  role: UserRole,
): Promise<void> {
  const codes = roleDefaultPermissions(role);
  if (codes !== 'ALL' && codes.length === 0) return;
  const permissions = await db.permission.findMany({
    where: codes === 'ALL' ? {} : { code: { in: [...codes] } },
    select: { id: true },
  });
  if (permissions.length === 0) return;
  await db.userPermission.createMany({
    data: permissions.map((p) => ({ userId, permissionId: p.id })),
    skipDuplicates: true,
  });
}
