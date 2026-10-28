import { UserRole } from '@prisma/client';
import { effectiveCodes, isAdminOnlyCode } from '../staff-codes';

describe('admin-only codes', () => {
  it('keeps people, permissions, settings, branding and the audit log with admins', () => {
    for (const c of ['permissions:manage', 'users:read', 'users:create', 'users:delete', 'settings:read', 'settings:write', 'company_branding:manage', 'audit:read']) {
      expect(isAdminOnlyCode(c)).toBe(true);
    }
    for (const c of ['projects:create', 'cms:pages:manage', 'campaigns:manage', 'reports:sales:read', 'leads:read']) {
      expect(isAdminOnlyCode(c)).toBe(false);
    }
  });

  it('an admin keeps every code; anyone else loses the admin-only ones', () => {
    const held = ['users:read', 'settings:write', 'cms:pages:manage'];
    expect([...effectiveCodes(UserRole.ADMIN, held)].sort()).toEqual([...held].sort());
    expect([...effectiveCodes(UserRole.SALES_MANAGER, held)]).toEqual(['cms:pages:manage']);
  });
});
