import { SetMetadata } from '@nestjs/common';

export const GRANTED_BY_KEY = 'grantedBy';

/**
 * Opens the route to any staff member who holds one of these codes, besides
 * the roles in @Roles (PRM — the permission opens the page). The code is then
 * the permission for the route. Admin-only codes never open anything to a
 * non-admin (common/permissions/staff-codes.ts).
 */
export const GrantedBy = (...codes: string[]) => SetMetadata(GRANTED_BY_KEY, codes);
