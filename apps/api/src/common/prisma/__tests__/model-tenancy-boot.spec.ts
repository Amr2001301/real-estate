import { Prisma } from '@prisma/client';
import { MODEL_TENANCY, ModelTenancyTier } from '../model-tenancy';
import { PrismaService } from '../prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const schemaModels = Prisma.dmmf.datamodel.models.map((m) => m.name);

function makeService(): PrismaService {
  // PrismaService extends PrismaClient. We only need assertModelTenancyComplete,
  // which does not touch the DB, so we instantiate without calling onModuleInit.
  return new PrismaService();
}

// ---------------------------------------------------------------------------
// MT-013 — MODEL_TENANCY boot completeness assertion
// ---------------------------------------------------------------------------

describe('MT-013 MODEL_TENANCY boot assertion', () => {
  it('every model in the live Prisma DMMF has exactly one classification', () => {
    const unclassified = schemaModels.filter((n) => !(n in MODEL_TENANCY));
    expect(unclassified).toEqual([]);
  });

  it('MODEL_TENANCY contains no ghost entries absent from the schema', () => {
    const schemaSet = new Set(schemaModels);
    const ghosts = Object.keys(MODEL_TENANCY).filter((n) => !schemaSet.has(n));
    expect(ghosts).toEqual([]);
  });

  it('assertModelTenancyComplete passes with the real DMMF (no error thrown)', () => {
    const svc = makeService();
    expect(() => svc.assertModelTenancyComplete()).not.toThrow();
  });

  it('assertModelTenancyComplete throws when a model is unclassified', () => {
    const svc = makeService();
    const injected = [
      ...Prisma.dmmf.datamodel.models,
      { name: 'InventoryAccessGrant' },
    ];
    expect(() => svc.assertModelTenancyComplete(injected)).toThrow(
      '[MT-013] Missing MODEL_TENANCY classification for: InventoryAccessGrant',
    );
  });

  it('assertModelTenancyComplete error names ALL unclassified models in one throw', () => {
    const svc = makeService();
    const injected = [
      ...Prisma.dmmf.datamodel.models,
      { name: 'ModelA' },
      { name: 'ModelB' },
    ];
    expect(() => svc.assertModelTenancyComplete(injected)).toThrow(
      'ModelA, ModelB',
    );
  });
});

// ---------------------------------------------------------------------------
// MT-012 spot-checks — key classification assertions
// ---------------------------------------------------------------------------

describe('MODEL_TENANCY tier spot-checks', () => {
  // User is the only TENANT_CONTROLLED model — middleware pass-through.
  it('User is TENANT_CONTROLLED', () => {
    expect(MODEL_TENANCY['User']).toBe<ModelTenancyTier>('TENANT_CONTROLLED');
  });

  // Auth-token models must be TENANT_VIA_RELATION (scoped through userId → User).
  it.each([
    'RefreshToken',
    'PasswordResetToken',
    'EmailVerificationToken',
    'DeviceToken',
  ])('%s is TENANT_VIA_RELATION', (model) => {
    expect(MODEL_TENANCY[model]).toBe<ModelTenancyTier>('TENANT_VIA_RELATION');
  });

  it('Company is PLATFORM_GLOBAL', () => {
    expect(MODEL_TENANCY['Company']).toBe<ModelTenancyTier>('PLATFORM_GLOBAL');
  });

  it.each(['Project', 'Lead', 'Contract', 'Deposit', 'Unit'])(
    '%s is TENANT_OWNED',
    (model) => {
      expect(MODEL_TENANCY[model]).toBe<ModelTenancyTier>('TENANT_OWNED');
    },
  );
});
