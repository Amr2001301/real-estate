import { Logger } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { InstallmentsService } from '../../installments/installments.module';
import { DepositsService } from '../../deposits/deposits.service';
import { ChequeLifecycleService } from '../../payment-instruments/payment-instruments.service';
import { BonusService } from '../../bonus/bonus.module';
import { runTenantContext } from '../../../common/tenant/tenant-context';

/**
 * Finance notifications: every money event reaches the customer it concerns
 * and, on the company side, the deal's sales person, admins and sales
 * managers — never the user who acted.
 */
const TENANT = { companyId: 'co-1', bypass: false as const, isPublic: false as const };
const STAFF_ROLES = [UserRole.ADMIN, UserRole.SALES_MANAGER];

function makeNotifications() {
  return {
    sendToUser: jest.fn().mockResolvedValue(undefined),
    sendToUsers: jest.fn().mockResolvedValue(undefined),
    sendToRoles: jest.fn().mockResolvedValue(undefined),
    sendToUsersAndRoles: jest.fn().mockResolvedValue(undefined),
  };
}

const CONTRACT = {
  id: 'contract-1',
  contractNumber: 'C-0042',
  customerId: 'customer-1',
  customer: { fullName: 'منى' },
  unit: { code: 'A-101' },
  reservation: { salesId: 'sales-1' },
};

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('installments', () => {
  it('an installment that turns overdue tells the customer, the sales person and the managers', async () => {
    const notifications = makeNotifications();
    const prisma = {
      installment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inst-1',
            amount: new Prisma.Decimal(25000),
            dueDate: new Date('2026-10-01T00:00:00Z'),
            companyId: 'co-1',
            plan: { contract: CONTRACT },
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const svc = new InstallmentsService(
      prisma as never,
      undefined,
      undefined,
      notifications as never,
    );
    await expect(svc.markOverdue()).resolves.toEqual({ marked: 1 });

    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'customer-1',
      'installment_overdue',
      expect.objectContaining({ amount: 25000, dueDate: '2026-10-01', contractNumber: 'C-0042' }),
    );
    expect(notifications.sendToUsersAndRoles).toHaveBeenCalledWith(
      ['sales-1'],
      STAFF_ROLES,
      'installment_overdue_staff',
      expect.objectContaining({ customerName: 'منى', unitCode: 'A-101' }),
    );
  });

  it('a new schedule reaches the customer and the sales person, not its creator', async () => {
    const notifications = makeNotifications();
    const tx = {
      installmentPlan: {
        create: jest.fn().mockResolvedValue({ id: 'plan-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'plan-1', installments: [] }),
      },
      installment: { createMany: jest.fn().mockResolvedValue({ count: 12 }) },
    };
    const prisma = {
      contract: {
        findUnique: jest.fn().mockResolvedValue({ ...CONTRACT, installmentPlan: null }),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const svc = new InstallmentsService(
      prisma as never,
      undefined,
      undefined,
      notifications as never,
    );
    await svc.createPlan(
      {
        contractId: 'contract-1',
        totalMonths: 12,
        monthlyAmount: 50000,
        startsAt: '2026-11-01',
      } as never,
      'admin-1',
    );

    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'customer-1',
      'installment_schedule_ready',
      expect.objectContaining({ totalMonths: 12, monthlyAmount: 50000, startsAt: '2026-11-01' }),
      { except: 'admin-1' },
    );
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'sales-1',
      'installment_schedule_ready_staff',
      expect.anything(),
      { except: 'admin-1' },
    );
  });
});

describe('deposits', () => {
  it('a reversal tells the customer their installment is due again, and the staff — not the admin who reversed', async () => {
    const notifications = makeNotifications();
    const reversal = {
      id: 'dep-1',
      reviewStatus: 'APPROVED',
      verified: true,
      amount: new Prisma.Decimal(25000),
      createdAt: new Date('2026-09-01'),
      reviewedAt: new Date('2026-09-02'),
      deletedAt: null,
      installmentId: 'inst-1',
      installment: { id: 'inst-1', status: 'PAID', paidAt: new Date('2026-09-02') },
    };
    const context = {
      amount: new Prisma.Decimal(25000),
      contractId: 'contract-1',
      reservationId: null,
      contract: CONTRACT,
      reservation: null,
    };
    const tx = {
      installment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      paymentCorrection: { create: jest.fn().mockResolvedValue({ id: 'corr-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      deposit: {
        findFirst: jest.fn(({ select }: { select: Record<string, unknown> }) =>
          Promise.resolve(select.contract ? context : reversal),
        ),
      },
      paymentCorrection: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const svc = new DepositsService(
      prisma as never,
      {} as never,
      notifications as never,
      {} as never,
    );
    jest.spyOn(svc, 'findOne').mockResolvedValue({} as never);

    await runTenantContext(TENANT, () =>
      svc.reverseDeposit('dep-1', { reason: 'cheque returned' }, { sub: 'admin-1' } as never),
    );

    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'customer-1',
      'deposit_reversed',
      expect.objectContaining({ amount: '25000', contractNumber: 'C-0042' }),
      { except: 'admin-1' },
    );
    expect(notifications.sendToUsersAndRoles).toHaveBeenCalledWith(
      ['sales-1'],
      STAFF_ROLES,
      'deposit_status_staff',
      expect.objectContaining({ unitCode: 'A-101', status: expect.stringContaining('عُكست') }),
      { except: 'admin-1' },
    );
  });
});

describe('cheques', () => {
  function setup(status: string) {
    const notifications = makeNotifications();
    const pi = {
      id: 'pi-1',
      status,
      type: 'CHEQUE',
      chequeNumber: '778899',
      referenceNumber: null,
      deposits: [
        {
          id: 'dep-1',
          reviewStatus: 'PENDING_REVIEW',
          installmentId: 'inst-1',
          installment: { id: 'inst-1', status: 'PENDING', planId: 'plan-1' },
          contract: CONTRACT,
        },
      ],
    };
    const tx = {
      paymentInstrument: { update: jest.fn().mockResolvedValue({}) },
      deposit: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      installment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      paymentInstrument: {
        findFirst: jest.fn().mockResolvedValue(pi),
        update: jest.fn().mockResolvedValue({ ...pi, status: 'DEPOSITED' }),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const svc = new ChequeLifecycleService(prisma as never, notifications as never);
    jest.spyOn(svc, 'findOne').mockResolvedValue({} as never);
    return { svc, notifications };
  }

  it('a cleared cheque reaches the customer and the staff, never the treasurer who cleared it', async () => {
    const { svc, notifications } = setup('DEPOSITED');
    await runTenantContext(TENANT, () => svc.transitionToCleared('pi-1', {}, 'treasurer-1'));

    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'customer-1',
      'cheque_status_changed',
      expect.objectContaining({ chequeNumber: '778899', status: 'تم تحصيله' }),
      { except: 'treasurer-1' },
    );
    expect(notifications.sendToUsersAndRoles).toHaveBeenCalledWith(
      ['sales-1'],
      STAFF_ROLES,
      'cheque_status_staff',
      expect.objectContaining({ customerName: 'منى', contractNumber: 'C-0042' }),
      { except: 'treasurer-1' },
    );
  });

  it('a cheque handed to the bank is news too', async () => {
    const { svc, notifications } = setup('PENDING_CLEARANCE');
    await runTenantContext(TENANT, () => svc.transitionToDeposited('pi-1', 'treasurer-1'));
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'customer-1',
      'cheque_status_changed',
      expect.objectContaining({ status: 'أُودع في البنك' }),
      { except: 'treasurer-1' },
    );
  });
});

describe('bonuses', () => {
  it('the sales person hears when their bonus is approved and paid', async () => {
    const notifications = makeNotifications();
    const prisma = {
      bonusEntry: {
        update: jest.fn(
          async ({ where, data }: { where: { id: string }; data: { status: string } }) => ({
            id: where.id,
            salesId: 'sales-1',
            amount: new Prisma.Decimal(12000),
            period: '2026-10',
            status: data.status,
          }),
        ),
      },
    };
    const svc = new BonusService(prisma as never, undefined, undefined, notifications as never);
    await svc.setEntryStatus('bonus-1', { status: 'PAID' } as never);
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'sales-1',
      'bonus_status_changed',
      expect.objectContaining({ amount: '12000', period: '2026-10', status: 'صُرفت' }),
    );
  });
});
