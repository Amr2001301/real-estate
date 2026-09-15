import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InstallmentStatus, MaintenanceStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { findTenantUser } from '../../common/tenant/resolve-tenant-entity';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// ── Types ─────────────────────────────────────────────────────────────────────

type CustomerType = 'OWNER' | 'BUYER' | 'CUSTOMER';

type PrimaryActionType =
  | 'OVERDUE_INSTALLMENT'
  | 'DUE_SOON_INSTALLMENT'
  | 'PENDING_DOCUMENT' // reserved — not activated in V1
  | 'MAINTENANCE_UPDATE'
  | 'UPCOMING_INSTALLMENT'
  | 'NO_ACTION_REQUIRED';

type Severity = 'danger' | 'warning' | 'info' | 'success' | 'neutral';

interface BilingualText {
  ar: string;
  en: string;
}

interface PrimaryAction {
  type: PrimaryActionType;
  severity: Severity;
  title: BilingualText;
  subtitle: BilingualText;
  amount?: string;
  currency?: string;
  dueDate?: string;
  cta: { label: BilingualText; route: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toAvatarInitials(name: string | null | undefined): string {
  if (!name?.trim()) return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const DUE_SOON_DAYS = 14;

/**
 * Guards against the daily-cron window where PENDING rows haven't yet been
 * promoted to OVERDUE by InstallmentsCron.markOverdue().
 */
function isEffectivelyOverdue(
  status: InstallmentStatus,
  dueDate: Date,
  now: Date,
): boolean {
  return (
    status === InstallmentStatus.OVERDUE ||
    (status === InstallmentStatus.PENDING && dueDate < now)
  );
}

function buildPrimaryAction(
  nextDue: {
    id: string;
    amount: { toString(): string };
    dueDate: Date;
    status: InstallmentStatus;
  } | null,
  openMaintenanceCount: number,
  now: Date,
): PrimaryAction {
  const noAction: PrimaryAction = {
    type: 'NO_ACTION_REQUIRED',
    severity: 'success',
    title: { ar: 'لا توجد إجراءات مطلوبة', en: 'No actions required' },
    subtitle: { ar: 'كل شيء على ما يرام', en: 'Everything is up to date' },
    cta: { label: { ar: 'عرض وحداتي', en: 'View my units' }, route: 'my-units' },
  };

  if (nextDue) {
    const overdue = isEffectivelyOverdue(nextDue.status, nextDue.dueDate, now);
    const daysUntil = Math.ceil(
      (nextDue.dueDate.getTime() - now.getTime()) / 86_400_000,
    );
    const dueSoon = !overdue && daysUntil <= DUE_SOON_DAYS;

    if (overdue) {
      return {
        type: 'OVERDUE_INSTALLMENT',
        severity: 'danger',
        title: { ar: 'قسط متأخر', en: 'Overdue installment' },
        subtitle: { ar: 'لديك قسط متأخر السداد', en: 'You have an overdue payment' },
        amount: nextDue.amount.toString(),
        currency: 'EGP',
        dueDate: nextDue.dueDate.toISOString(),
        cta: { label: { ar: 'عرض الأقساط', en: 'View installments' }, route: 'installments' },
      };
    }

    if (dueSoon) {
      return {
        type: 'DUE_SOON_INSTALLMENT',
        severity: 'warning',
        title: { ar: 'قسط قادم قريباً', en: 'Installment due soon' },
        subtitle: { ar: 'يستحق خلال أقل من أسبوعين', en: 'Due in less than two weeks' },
        amount: nextDue.amount.toString(),
        currency: 'EGP',
        dueDate: nextDue.dueDate.toISOString(),
        cta: { label: { ar: 'عرض الأقساط', en: 'View installments' }, route: 'installments' },
      };
    }
  }

  if (openMaintenanceCount > 0) {
    return {
      type: 'MAINTENANCE_UPDATE',
      severity: 'info',
      title: { ar: 'طلبات صيانة مفتوحة', en: 'Open maintenance requests' },
      subtitle: {
        ar: `لديك ${openMaintenanceCount} طلب صيانة قيد التنفيذ`,
        en: `You have ${openMaintenanceCount} open maintenance request${openMaintenanceCount === 1 ? '' : 's'}`,
      },
      cta: { label: { ar: 'عرض الصيانة', en: 'View maintenance' }, route: 'maintenance' },
    };
  }

  if (nextDue) {
    return {
      type: 'UPCOMING_INSTALLMENT',
      severity: 'neutral',
      title: { ar: 'القسط القادم', en: 'Upcoming installment' },
      subtitle: { ar: 'موعد السداد القادم', en: 'Your next payment is scheduled' },
      amount: nextDue.amount.toString(),
      currency: 'EGP',
      dueDate: nextDue.dueDate.toISOString(),
      cta: { label: { ar: 'عرض الأقساط', en: 'View installments' }, route: 'installments' },
    };
  }

  return noAction;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
class MeHomeSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const now = new Date();

    const [
      user,
      primaryContract,
      ownedUnitsCount,
      totalInstallments,
      paidInstallments,
      effectiveOverdueCount,
      nextDue,
      lastPaidInstallment,
      openMaintenanceCount,
      recentMaintenance,
      unreadNotifCount,
    ] = await Promise.all([
      // Q0: customer display name (scoped to current tenant via findTenantUser)
      findTenantUser(this.prisma, userId, { fullName: true }),

      // Q1: most recently signed contract → primary property
      this.prisma.contract.findFirst({
        where: { customerId: userId, signedAt: { not: null } },
        orderBy: { signedAt: 'desc' },
        select: {
          id: true,
          contractNumber: true,
          signedAt: true,
          unit: {
            select: {
              id: true,
              code: true,
              type: true,
              building: {
                select: {
                  phase: {
                    select: {
                      project: { select: { name: true, city: true } },
                    },
                  },
                },
              },
            },
          },
          installmentPlan: {
            select: { totalMonths: true, monthlyAmount: true },
          },
        },
      }),

      // Q2: count of signed contracts (owned units)
      this.prisma.contract.count({
        where: { customerId: userId, signedAt: { not: null } },
      }),

      // Q3a: total installments across all contracts
      this.prisma.installment.count({
        where: { plan: { contract: { customerId: userId } } },
      }),

      // Q3b: paid installments
      this.prisma.installment.count({
        where: {
          plan: { contract: { customerId: userId } },
          status: InstallmentStatus.PAID,
        },
      }),

      // Q3c: effective overdue — covers the daily-cron gap where PENDING rows
      // haven't been promoted to OVERDUE yet.
      this.prisma.installment.count({
        where: {
          plan: { contract: { customerId: userId } },
          OR: [
            { status: InstallmentStatus.OVERDUE },
            { status: InstallmentStatus.PENDING, dueDate: { lt: now } },
          ],
        },
      }),

      // Q4: earliest unpaid installment — explicit IN excludes CANCELLED (Step D1).
      this.prisma.installment.findFirst({
        where: {
          plan: { contract: { customerId: userId } },
          status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
        },
        orderBy: { dueDate: 'asc' },
        select: { id: true, amount: true, dueDate: true, status: true },
      }),

      // Q5: most recently paid installment (for lastPaidAt)
      this.prisma.installment.findFirst({
        where: {
          plan: { contract: { customerId: userId } },
          status: InstallmentStatus.PAID,
          paidAt: { not: null },
        },
        orderBy: { paidAt: 'desc' },
        select: { paidAt: true },
      }),

      // Q6: open maintenance request count
      this.prisma.maintenanceRequest.count({
        where: {
          customerId: userId,
          status: {
            in: [
              MaintenanceStatus.OPEN,
              MaintenanceStatus.ASSIGNED,
              MaintenanceStatus.IN_PROGRESS,
            ],
          },
        },
      }),

      // Q7: three most recent maintenance requests
      this.prisma.maintenanceRequest.findMany({
        where: { customerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          status: true,
          priority: true,
          createdAt: true,
          unit: { select: { code: true } },
          items: { take: 1, select: { category: { select: { name: true } } } },
          category: { select: { name: true } },
        },
      }),

      // Q8: unread notification count
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);

    // Q9: determines BUYER vs CUSTOMER — only runs when no signed contracts.
    let customerType: CustomerType = 'OWNER';
    if (ownedUnitsCount === 0) {
      const pendingCount = await this.prisma.contract.count({
        where: { customerId: userId, signedAt: null },
      });
      customerType = pendingCount > 0 ? 'BUYER' : 'CUSTOMER';
    }

    // ── primaryProperty ──────────────────────────────────────────────────────
    const project = primaryContract?.unit?.building?.phase?.project;
    const rawProjectName = (project?.name ?? {}) as { ar?: string; en?: string };

    const primaryProperty = primaryContract
      ? {
          contractId: primaryContract.id,
          contractNumber: primaryContract.contractNumber ?? null,
          unitId: primaryContract.unit?.id ?? '',
          unitCode: primaryContract.unit?.code ?? '',
          unitType: primaryContract.unit?.type ?? '',
          projectName: { ar: rawProjectName.ar ?? '', en: rawProjectName.en ?? '' },
          city: project?.city ?? '',
          status: 'OWNED' as const,
          signedAt: primaryContract.signedAt?.toISOString() ?? null,
          monthlyAmount:
            primaryContract.installmentPlan?.monthlyAmount?.toString() ?? null,
          totalMonths: primaryContract.installmentPlan?.totalMonths ?? null,
        }
      : null;

    // ── installments ─────────────────────────────────────────────────────────
    const installments = {
      nextDue: nextDue
        ? {
            id: nextDue.id,
            amount: nextDue.amount.toString(),
            currency: 'EGP' as const,
            dueDate: nextDue.dueDate.toISOString(),
            status: isEffectivelyOverdue(nextDue.status, nextDue.dueDate, now)
              ? ('OVERDUE' as const)
              : ('PENDING' as const),
          }
        : null,
      paidCount: paidInstallments,
      totalCount: totalInstallments,
      remainingCount: totalInstallments - paidInstallments,
      overdueCount: effectiveOverdueCount,
      lastPaidAt: lastPaidInstallment?.paidAt?.toISOString() ?? null,
    };

    // ── maintenance ───────────────────────────────────────────────────────────
    const maintenance = {
      openCount: openMaintenanceCount,
      recentRequests: recentMaintenance.map((r) => {
        const rawName = (
          r.items[0]?.category?.name ?? r.category?.name ?? null
        ) as { ar?: string; en?: string } | null;
        return {
          id: r.id,
          categoryName: rawName
            ? { ar: rawName.ar ?? '', en: rawName.en ?? '' }
            : null,
          status: r.status as string,
          priority: (r.priority ?? 'MEDIUM') as string,
          createdAt: r.createdAt?.toISOString() ?? '',
          unitCode: r.unit?.code ?? null,
        };
      }),
    };

    // ── profile ───────────────────────────────────────────────────────────────
    const displayName = user?.fullName ?? '';

    return {
      profile: {
        displayName,
        customerType,
        ownedUnitsCount,
        avatarInitials: toAvatarInitials(displayName),
      },
      notifications: { unreadCount: unreadNotifCount },
      primaryAction: buildPrimaryAction(nextDue, openMaintenanceCount, now),
      primaryProperty,
      installments,
      maintenance,
    };
  }
}

// ── Controller ────────────────────────────────────────────────────────────────

@ApiTags('me-home')
@Controller('me/home-summary')
class MeHomeSummaryController {
  constructor(private readonly svc: MeHomeSummaryService) {}

  @Roles(UserRole.CUSTOMER)
  @Get()
  summary(@CurrentUser() user: AuthUser) {
    return this.svc.getSummary(user.sub);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────

@Module({
  controllers: [MeHomeSummaryController],
  providers: [MeHomeSummaryService],
})
export class MeHomeModule {}
