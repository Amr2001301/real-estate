import * as fs from 'fs';
import * as path from 'path';
import * as argon2 from 'argon2';
import { UserRole } from '@prisma/client';
import { PERMISSION_CATALOG } from '../permission-catalog';
import { bootstrapSuperAdmin, syncPermissionCatalog } from '../permission-catalog.bootstrap';
import {
  MAINTENANCE_SUPERVISOR_DEFAULT_PERMISSIONS,
  SALES_MANAGER_DEFAULT_PERMISSIONS,
  SALES_DEFAULT_PERMISSIONS,
} from '../role-default-permissions';

/** Every code a controller checks, read from the source. */
function codesCheckedInSource(): Set<string> {
  const root = path.resolve(__dirname, '../../..');
  const codes = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(full);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
        const src = fs.readFileSync(full, 'utf8');
        for (const m of src.matchAll(/@Permissions(?:Strict)?\(([^)]*)\)/g)) {
          for (const c of m[1]!.matchAll(/'([^']+)'/g)) codes.add(c[1]!);
        }
      }
    }
  };
  walk(root);
  return codes;
}

describe('permission catalog (F1)', () => {
  const catalog = new Set(PERMISSION_CATALOG.map((p) => p.code));

  it('lists every code a controller checks', () => {
    const checked = codesCheckedInSource();
    expect(checked.size).toBeGreaterThan(100);
    expect([...checked].filter((c) => !catalog.has(c))).toEqual([]);
  });

  it('lists every code a role is granted by default, once', () => {
    const tiers = [
      ...SALES_DEFAULT_PERMISSIONS,
      ...SALES_MANAGER_DEFAULT_PERMISSIONS,
      ...MAINTENANCE_SUPERVISOR_DEFAULT_PERMISSIONS,
    ];
    expect(tiers.filter((c) => !catalog.has(c))).toEqual([]);
    expect(catalog.size).toBe(PERMISSION_CATALOG.length);
  });

  it('writes only the missing codes', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 3 });
    const db = { permission: { createMany } } as never;
    await expect(syncPermissionCatalog(db)).resolves.toBe(3);
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(createMany.mock.calls[0][0].data).toHaveLength(PERMISSION_CATALOG.length);
  });
});

describe('platform owner bootstrap (F1)', () => {
  const env = {
    SUPER_ADMIN_EMAIL: ' Owner@Example.com ',
    SUPER_ADMIN_PASSWORD: 'a-long-password-1',
  };
  const dbWith = (existing: { id: string } | null) => {
    const create = jest.fn().mockResolvedValue({});
    return {
      create,
      db: { user: { findFirst: jest.fn().mockResolvedValue(existing), create } } as never,
    };
  };

  it('does nothing without the env', async () => {
    const { db, create } = dbWith(null);
    await expect(bootstrapSuperAdmin(db, {})).resolves.toBe('not-configured');
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the first SUPER_ADMIN, in no company', async () => {
    const { db, create } = dbWith(null);
    await expect(bootstrapSuperAdmin(db, env)).resolves.toBe('created');
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      role: UserRole.SUPER_ADMIN,
      email: 'owner@example.com',
      companyId: null,
    });
    expect(await argon2.verify(data.passwordHash, env.SUPER_ADMIN_PASSWORD)).toBe(true);
  });

  it('never touches an existing SUPER_ADMIN', async () => {
    const { db, create } = dbWith({ id: 'x' });
    await expect(bootstrapSuperAdmin(db, env)).resolves.toBe('exists');
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses a short password', async () => {
    const { db } = dbWith(null);
    await expect(
      bootstrapSuperAdmin(db, { ...env, SUPER_ADMIN_PASSWORD: 'short' }),
    ).rejects.toThrow('at least 12');
  });
});
