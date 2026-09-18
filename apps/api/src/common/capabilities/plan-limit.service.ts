/**
 * Phase 2 — PlanLimitService
 *
 * Enforces creation limits at the service layer.  Only new CREATION is blocked;
 * reads, updates, and deletes always succeed regardless of current usage.
 *
 * Counting semantics (from capability-schema.ts definitions):
 *   limit.maxUsers    — STAFF_SEAT_ROLES only; soft-deleted excluded; inactive counted
 *   limit.maxUnits    — all units including SOLD
 *   limit.maxProjects — all projects
 *
 * ENTERPRISE / CUSTOM companies have null limits and are never blocked.
 *
 * Race condition: the count check and the create are not in a single serializable
 * transaction.  Two simultaneous creates at limit-1 can both pass the count check
 * and both succeed, producing a one-row overshoot.  This is accepted at current
 * scale; a DB-level advisory lock or serializable isolation would prevent it at
 * the cost of increased latency and contention.
 */

import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CapabilityService } from './capability.service';
import { STAFF_SEAT_ROLES } from './capability-schema';
import { getRequiredCompanyId } from '../tenant/tenant-context';
import type { UserRole } from '@prisma/client';

@Injectable()
export class PlanLimitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilityService: CapabilityService,
  ) {}

  /**
   * Throws ForbiddenException if the company is at or over its staff-user limit.
   * CLIENT and CUSTOMER roles are excluded from the seat count and are never blocked.
   * Call this before creating a new user; pass the intended role so non-staff roles
   * are skipped without a DB query.
   */
  async checkUserLimit(intendedRole: UserRole): Promise<void> {
    const staffRoles: readonly UserRole[] = STAFF_SEAT_ROLES;
    if (!staffRoles.includes(intendedRole)) return; // CLIENT/CUSTOMER — no limit

    const companyId = getRequiredCompanyId();
    const limits = await this.capabilityService.getEffectiveLimits(companyId);
    const maxUsers = limits['limit.maxUsers'] as number | null;
    if (maxUsers === null) return; // unlimited (ENTERPRISE / CUSTOM)

    const currentCount = await this.prisma.user.count({
      where: {
        companyId,
        role: { in: [...STAFF_SEAT_ROLES] },
        deletedAt: null,
      },
    });

    if (currentCount >= maxUsers) {
      throw new ForbiddenException({
        message: `User limit reached. Your plan allows ${maxUsers} staff user${maxUsers !== 1 ? 's' : ''}; you currently have ${currentCount}. Upgrade your plan or contact support to add more.`,
        code: 'PLAN_LIMIT_REACHED',
        limit: 'limit.maxUsers',
        current: currentCount,
        max: maxUsers,
      });
    }
  }

  /**
   * Throws ForbiddenException if the company is at or over its unit limit.
   * All units (including SOLD) are counted.
   * Call this before creating a new unit.
   */
  async checkUnitLimit(): Promise<void> {
    const companyId = getRequiredCompanyId();
    const limits = await this.capabilityService.getEffectiveLimits(companyId);
    const maxUnits = limits['limit.maxUnits'] as number | null;
    if (maxUnits === null) return;

    const currentCount = await this.prisma.unit.count({
      where: { building: { phase: { project: { companyId } } } },
    });

    if (currentCount >= maxUnits) {
      throw new ForbiddenException({
        message: `Unit limit reached. Your plan allows ${maxUnits} unit${maxUnits !== 1 ? 's' : ''}; you currently have ${currentCount}. Upgrade your plan or contact support to add more.`,
        code: 'PLAN_LIMIT_REACHED',
        limit: 'limit.maxUnits',
        current: currentCount,
        max: maxUnits,
      });
    }
  }

  /**
   * Throws ForbiddenException if the company is at or over its project limit.
   * All projects regardless of status are counted.
   * Call this before creating a new project.
   */
  async checkProjectLimit(): Promise<void> {
    const companyId = getRequiredCompanyId();
    const limits = await this.capabilityService.getEffectiveLimits(companyId);
    const maxProjects = limits['limit.maxProjects'] as number | null;
    if (maxProjects === null) return;

    const currentCount = await this.prisma.project.count({ where: { companyId } });

    if (currentCount >= maxProjects) {
      throw new ForbiddenException({
        message: `Project limit reached. Your plan allows ${maxProjects} project${maxProjects !== 1 ? 's' : ''}; you currently have ${currentCount}. Upgrade your plan or contact support to add more.`,
        code: 'PLAN_LIMIT_REACHED',
        limit: 'limit.maxProjects',
        current: currentCount,
        max: maxProjects,
      });
    }
  }
}
