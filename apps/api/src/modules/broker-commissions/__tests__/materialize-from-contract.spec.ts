import { Test } from '@nestjs/testing';
import { BrokerCommissionsService } from '../broker-commissions.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.module';
import { BrokerCommissionStatus, Prisma } from '@prisma/client';

// Minimal contract fixture for materializeFromContract.
function makeContract(overrides: {
  totalAmount: string;
  lockedPct: string | null;
  lockedAmount: string | null;
  signedAt?: Date;
  brokerId?: string;
}) {
  return {
    id: 'contract-1',
    contractNumber: 'C-0001',
    signedAt: overrides.signedAt ?? new Date('2026-01-01'),
    totalAmount: new Prisma.Decimal(overrides.totalAmount),
    brokerId: overrides.brokerId ?? 'broker-1',
    brokerAgentId: null,
    reservationId: 'res-1',
    unitId: 'unit-1',
    unit: {
      id: 'unit-1',
      code: 'U-101',
      building: { phase: { projectId: 'project-1' } },
    },
    reservation: {
      id: 'res-1',
      reservationNumber: 'R-0001',
      brokerId: 'broker-1',
      commissionLockedPct: overrides.lockedPct !== null ? new Prisma.Decimal(overrides.lockedPct) : null,
      commissionLockedAmount: overrides.lockedAmount !== null ? new Prisma.Decimal(overrides.lockedAmount) : null,
      lead: { id: 'lead-1', fullName: 'Test Client' },
    },
    brokerCommission: null,
  };
}

describe('BrokerCommissionsService.materializeFromContract', () => {
  let service: BrokerCommissionsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockCommissionNumber = 'BC-0001';

  beforeEach(async () => {
    const prismaMock = {
      brokerCommission: {
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      contract: { findUnique: jest.fn() },
      broker: { findUnique: jest.fn().mockResolvedValue(null) },
      brokerProjectAccess: { findFirst: jest.fn().mockResolvedValue(null) },
      leadActivity: { create: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          brokerCommission: { create: jest.fn().mockResolvedValue({ id: 'comm-1', commissionNumber: mockCommissionNumber }) },
          leadActivity: { create: jest.fn() },
        }),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        BrokerCommissionsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: NotificationsService,
          useValue: { sendToUsers: jest.fn(), sendToUser: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(BrokerCommissionsService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  it('computes grossAmount from lockedPct × contract.totalAmount, not lockedAmount', async () => {
    // Scenario: PERCENT_OF_SALE deal at 2.5%.
    // At reservation time, snapshot.totalPayable was 2,032,000 (installment plan),
    // so commissionLockedAmount = 2.5% × 2,032,000 = 50,800.
    // The final contract.totalAmount is 850,000 (cash/base price).
    // Correct commission should be 2.5% × 850,000 = 21,250 — NOT 50,800.
    const contract = makeContract({
      totalAmount: '850000',   // final contract value
      lockedPct: '2.5',        // rate locked at reservation time
      lockedAmount: '50800',   // stale: was computed on totalPayable=2,032,000
    });

    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(contract);

    let capturedData: Prisma.BrokerCommissionCreateInput | undefined;
    (prisma.$transaction as jest.Mock).mockImplementation(
      (fn: (tx: { brokerCommission: { create: jest.Mock }; leadActivity: { create: jest.Mock } }) => Promise<unknown>) =>
        fn({
          brokerCommission: {
            create: jest.fn().mockImplementation(({ data }: { data: Prisma.BrokerCommissionCreateInput }) => {
              capturedData = data;
              return Promise.resolve({ id: 'comm-1', commissionNumber: mockCommissionNumber });
            }),
          },
          leadActivity: { create: jest.fn() },
        }),
    );

    const result = await service.materializeFromContract('contract-1');

    expect(result.status).toBe('created');
    expect(capturedData).toBeDefined();
    // grossAmount must be lockedPct × basisAmount = 2.5% × 850,000 = 21,250
    expect(Number(capturedData!.grossAmount)).toBeCloseTo(21250, 0);
    // netAmount = grossAmount (no tax)
    expect(Number(capturedData!.netAmount)).toBeCloseTo(21250, 0);
    // basisAmount = contract.totalAmount
    expect(Number(capturedData!.basisAmount)).toBe(850000);
  });

  it('uses lockedAmount directly for FIXED_PER_UNIT (no lockedPct)', async () => {
    // Scenario: FIXED_PER_UNIT — lockedPct is null, commission is a flat amount.
    const contract = makeContract({
      totalAmount: '850000',
      lockedPct: null,
      lockedAmount: '15000', // fixed per unit
    });

    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(contract);

    let capturedData: Prisma.BrokerCommissionCreateInput | undefined;
    (prisma.$transaction as jest.Mock).mockImplementation(
      (fn: (tx: { brokerCommission: { create: jest.Mock }; leadActivity: { create: jest.Mock } }) => Promise<unknown>) =>
        fn({
          brokerCommission: {
            create: jest.fn().mockImplementation(({ data }: { data: Prisma.BrokerCommissionCreateInput }) => {
              capturedData = data;
              return Promise.resolve({ id: 'comm-2', commissionNumber: mockCommissionNumber });
            }),
          },
          leadActivity: { create: jest.fn() },
        }),
    );

    const result = await service.materializeFromContract('contract-1');

    expect(result.status).toBe('created');
    expect(Number(capturedData!.grossAmount)).toBe(15000);
  });

  it('falls back to broker current rate when reservation has no commission lock (admin-CRM path)', async () => {
    // Scenario: reservation created through admin CRM — neither lockedPct nor
    // lockedAmount are set. The service should look up the broker's current rate
    // and compute the commission rather than skipping.
    const contract = makeContract({
      totalAmount: '850000',
      lockedPct: null,
      lockedAmount: null,
    });

    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(contract);

    // Mock broker lookup: PERCENT_OF_SALE at 2.5%
    (prisma.broker.findUnique as jest.Mock).mockResolvedValue({
      defaultCommissionPct: new Prisma.Decimal('2.5'),
      commissionModel: 'PERCENT_OF_SALE',
    });
    (prisma.brokerProjectAccess.findFirst as jest.Mock).mockResolvedValue(null);

    let capturedData: Prisma.BrokerCommissionCreateInput | undefined;
    (prisma.$transaction as jest.Mock).mockImplementation(
      (fn: (tx: { brokerCommission: { create: jest.Mock }; leadActivity: { create: jest.Mock } }) => Promise<unknown>) =>
        fn({
          brokerCommission: {
            create: jest.fn().mockImplementation(({ data }: { data: Prisma.BrokerCommissionCreateInput }) => {
              capturedData = data;
              return Promise.resolve({ id: 'comm-3', commissionNumber: mockCommissionNumber });
            }),
          },
          leadActivity: { create: jest.fn() },
        }),
    );

    const result = await service.materializeFromContract('contract-1');

    expect(result.status).toBe('created');
    // 2.5% × 850,000 = 21,250
    expect(Number(capturedData!.grossAmount)).toBeCloseTo(21250, 0);
  });

  it('skips when neither lock fields are set AND broker has no commission rate configured', async () => {
    const contract = makeContract({
      totalAmount: '850000',
      lockedPct: null,
      lockedAmount: null,
    });

    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(contract);
    (prisma.broker.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.brokerProjectAccess.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await service.materializeFromContract('contract-1');
    expect(result.status).toBe('skipped');
  });

  it('returns already_exists when commission exists', async () => {
    const contract = {
      ...makeContract({ totalAmount: '850000', lockedPct: '2.5', lockedAmount: '21250' }),
      brokerCommission: { id: 'comm-existing', commissionNumber: 'BC-0001' },
    };

    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(contract);

    const result = await service.materializeFromContract('contract-1');
    expect(result.status).toBe('already_exists');
    expect(result.commissionId).toBe('comm-existing');
  });
});
