import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  applyReadPolicy,
  applyCreatePolicy,
  applyCreateManyPolicy,
  TENANT_SCOPED_MODELS,
} from './tenant-query-policy';
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

const POLICY_OPTS = { scopedModels: TENANT_SCOPED_MODELS };

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // $use is deprecated in Prisma 5 — scheduled for removal in Prisma 6.
    // Migration path: when PrismaService is refactored from `extends PrismaClient`
    // to composition, replace this with $extends({ query: { ... } }).
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.$use(this.tenantMiddleware.bind(this));
    await this.$connect();
    this.logger.log('Prisma connected');
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
      if (TENANT_SCOPED_MODELS.has(modelKey)) {
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
