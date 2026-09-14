import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  applyReadPolicy,
  applyCreatePolicy,
  applyCreateManyPolicy,
  getModelTier,
  MODEL_TIER_BY_LOWERCASE,
} from './tenant-query-policy';
import { MODEL_TENANCY } from './model-tenancy';
import { getTenantContext } from '../tenant/tenant-context';
import { TenantScopeViolationError } from '../tenant/tenant-context.errors';

type MiddlewareNext = (params: Prisma.MiddlewareParams) => Promise<unknown>;

const READ_OPS = new Set([
  'findMany', 'findFirst', 'findUnique',
  'findFirstOrThrow', 'findUniqueOrThrow',
  'count', 'aggregate', 'groupBy',
  'update', 'updateMany',
  'delete', 'deleteMany',
]);

// MT-014: derive the TENANT_OWNED set from MODEL_TENANCY (single source of truth).
const TENANT_OWNED_MODELS: ReadonlySet<string> = new Set(
  [...MODEL_TIER_BY_LOWERCASE].filter(([, t]) => t === 'TENANT_OWNED').map(([k]) => k),
);
const POLICY_OPTS = { scopedModels: TENANT_OWNED_MODELS as Set<string> };

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // MT-013 — fail-closed boot assertion.
    // Every model in the current Prisma schema must have exactly one
    // MODEL_TENANCY classification. A missing entry means a new model was
    // added without a security classification — we refuse to start rather
    // than silently leaving data unprotected.
    this.assertModelTenancyComplete();

    // MT-016 — every model with a companyId column must be tenant-aware.
    this.assertCompanyIdModelsClassified();

    // MT-015 — verify the Prisma middleware API is still present before using it.
    // $use is deprecated in Prisma 5 and removed in Prisma 6. If a Prisma major
    // version upgrade removes $use, tenant scoping silently disappears unless this
    // guard fails startup first.
    this.assertMiddlewareApiAvailable();

    // $use is deprecated in Prisma 5 — scheduled for removal in Prisma 6.
    // Migration path: when PrismaService is refactored from `extends PrismaClient`
    // to composition, replace this with $extends({ query: { ... } }).
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.$use(this.tenantMiddleware.bind(this));
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  /**
   * MT-013 — Verify every Prisma model has a MODEL_TENANCY classification.
   * Called at startup; throws if any model is unclassified (fail-closed).
   *
   * Exposed as a non-private method so tests can call it directly against a
   * mock dmmf without starting a real database connection.
   */
  assertModelTenancyComplete(
    models: ReadonlyArray<{ name: string }> = Prisma.dmmf.datamodel.models,
  ): void {
    const unclassified = models
      .map((m) => m.name)
      .filter((name) => !(name in MODEL_TENANCY));

    if (unclassified.length > 0) {
      throw new Error(
        `[MT-013] Missing MODEL_TENANCY classification for: ${unclassified.join(', ')}. ` +
          'Every Prisma model must be classified before the application can start. ' +
          'Add the missing model(s) to apps/api/src/common/prisma/model-tenancy.ts.',
      );
    }
  }

  /**
   * MT-016 — Verify every model with a `companyId` column is classified as
   * TENANT_OWNED or TENANT_CONTROLLED. PLATFORM_GLOBAL / TENANT_VIA_RELATION
   * models must not have a companyId field (they are cross-tenant by design).
   *
   * Exposed as a non-private method so tests can inject a synthetic DMMF.
   */
  assertCompanyIdModelsClassified(
    models: ReadonlyArray<{ name: string; fields: ReadonlyArray<{ name: string; isRequired?: boolean }> }> =
      Prisma.dmmf.datamodel.models,
  ): void {
    const tenantAware = new Set<string>(['TENANT_OWNED', 'TENANT_CONTROLLED']);
    const violators: string[] = [];

    for (const model of models) {
      // A nullable companyId? is a legitimate cross-tenant reference (e.g. PricingPackage).
      // Only a required (non-nullable) companyId signals tenant ownership.
      const hasRequiredCompanyId = model.fields.some(
        (f) => f.name === 'companyId' && f.isRequired !== false,
      );
      if (!hasRequiredCompanyId) continue;

      const tier = MODEL_TENANCY[model.name as keyof typeof MODEL_TENANCY];
      if (!tier || !tenantAware.has(tier)) {
        violators.push(`${model.name} (${tier ?? 'UNCLASSIFIED'})`);
      }
    }

    if (violators.length > 0) {
      throw new Error(
        `[MT-016] Models with a companyId column must be classified as TENANT_OWNED or ` +
          `TENANT_CONTROLLED. Violations: ${violators.join(', ')}. ` +
          'Fix the classification in apps/api/src/common/prisma/model-tenancy.ts.',
      );
    }
  }

  /**
   * MT-015 — Verify that the Prisma `$use` middleware API is still present.
   * $use is deprecated in Prisma 5 and removed in Prisma 6. If a Prisma upgrade
   * removes it before the codebase migrates to `$extends`, all tenant scoping
   * silently disappears. This guard causes startup to fail with a clear message.
   *
   * Exposed as a non-private method so tests can verify the guard logic.
   */
  assertMiddlewareApiAvailable(): void {
    if (typeof this.$use !== 'function') {
      throw new Error(
        '[MT-015] PrismaClient.$use is no longer available — tenant middleware cannot be ' +
          'registered. Migrate from $use to $extends({ query: { ... } }) before upgrading ' +
          'Prisma past version 5.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async tenantMiddleware(
    params: Prisma.MiddlewareParams,
    next: MiddlewareNext,
  ): Promise<unknown> {
    const modelKey = params.model?.toLowerCase();
    if (!modelKey) return next(params);

    // MT-014: fail-closed runtime guard — defense-in-depth on top of boot
    // assertion. getModelTier throws for any model not in MODEL_TENANCY.
    // In practice this is unreachable after boot, but provides a clear error
    // if somehow a new model slips through (e.g. in testing with a patched DMMF).
    const tier = getModelTier(modelKey);

    let args = (params.args ?? {}) as Record<string, unknown>;

    if (READ_OPS.has(params.action)) {
      args = applyReadPolicy(modelKey, args as Parameters<typeof applyReadPolicy>[1], POLICY_OPTS);
    } else if (params.action === 'create') {
      args = applyCreatePolicy(modelKey, args as Parameters<typeof applyCreatePolicy>[1], POLICY_OPTS);
    } else if (params.action === 'createMany') {
      args = applyCreateManyPolicy(modelKey, args as Parameters<typeof applyCreateManyPolicy>[1], POLICY_OPTS);
    } else if (params.action === 'upsert') {
      // Scope the where so an attacker cannot upsert another tenant's record.
      args = applyReadPolicy(modelKey, args as Parameters<typeof applyReadPolicy>[1], POLICY_OPTS);
      // Inject companyId into the create branch independently of applyCreatePolicy,
      // because upsert.create is not at args.data — it's at args.create.
      // MT-014: tier check sourced from MODEL_TENANCY.
      if (tier === 'TENANT_OWNED') {
        const tenantCtx = getTenantContext();
        if (tenantCtx && !tenantCtx.bypass && tenantCtx.companyId) {
          const typed = args as Record<string, unknown>;
          const createBranch = (typed.create ?? {}) as Record<string, unknown>;
          if ('companyId' in createBranch && createBranch.companyId !== tenantCtx.companyId) {
            throw new TenantScopeViolationError(
              `upsert on '${modelKey}': create branch companyId conflicts with active tenant`,
            );
          }
          args = { ...typed, create: { ...createBranch, companyId: tenantCtx.companyId } };
        }
      }
    }

    return next({ ...params, args });
  }
}
