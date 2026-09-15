/**
 * DepositsService — reverseDeposit + FG-06 (verify false on APPROVED deposit).
 *
 * Covers (09-reversal-design.md §5.1, §6.2, §6.3, §8.1 Step C):
 *   - deposits:reverse (POST /deposits/:id/reverse): writes PaymentCorrection(REVERSAL),
 *     reopens installment as PENDING, preserves paidAt, writes AuditLog
 *   - 404 for missing / cross-tenant deposit
 *   - 400 for non-APPROVED deposit
 *   - 400 for deposit without installment
 *   - 400 if reason is missing
 *   - FG-06: verify(false) on APPROVED deposit with PAID installment routes through
 *     reversal path (PaymentCorrection written, installment reopened)
 */

import {
  CallHandler,
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Injectable,
  Module,
  NestInterceptor,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Observable } from 'rxjs';
import request from 'supertest';
import { DepositReviewStatus, UserRole } from '@prisma/client';
import { DepositsModule } from '../deposits.module';
import { DocumentsService } from '../../documents/documents.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { enterTenantContext } from '../../../common/tenant/tenant-context';

const COMPANY_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const ADMIN_ID = 'admin-000-0000-4000-8000-000000000001';
const DEP_ID = 'dddddddd-1111-4111-8111-111111111111';
const INST_ID = 'iiiiiiii-2222-4222-8222-222222222222';

// ── Fake tenant interceptor ───────────────────────────────────────────────────

@Injectable()
class FakeTenantInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return new Observable((subscriber) => {
      enterTenantContext({ companyId: COMPANY_A, bypass: false, isPublic: false });
      next.handle().subscribe(subscriber);
    });
  }
}

// ── Fake auth guard ───────────────────────────────────────────────────────────

class FakeAuthGuard implements CanActivate {
  static user: { sub: string; role: UserRole; codes: string[] } = {
    sub: ADMIN_ID,
    role: UserRole.ADMIN,
    codes: ['deposits:reverse', 'deposits:verify', 'deposits:read'],
  };

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { sub: FakeAuthGuard.user.sub, role: FakeAuthGuard.user.role, email: null, phone: null };
    return true;
  }
}

// ── Deposit fixture ───────────────────────────────────────────────────────────

interface DepositFixture {
  id: string;
  reviewStatus: DepositReviewStatus;
  verified: boolean;
  amount: string;
  installmentId: string | null;
  installment: { id: string; status: string; paidAt: Date | null } | null;
  receiptUrl: string | null;
}

let depositFixture: DepositFixture | null = null;
const createdCorrections: Array<Record<string, unknown>> = [];
const createdAuditLogs: Array<Record<string, unknown>> = [];

function makeApprovedDeposit(): DepositFixture {
  return {
    id: DEP_ID,
    reviewStatus: DepositReviewStatus.APPROVED,
    verified: true,
    amount: '10000',
    installmentId: INST_ID,
    installment: { id: INST_ID, status: 'PAID', paidAt: new Date('2026-09-01') },
    receiptUrl: 'https://r2.example/receipt.pdf',
  };
}

// ── Prisma mock ───────────────────────────────────────────────────────────────

function makePrismaMock() {
  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () =>
        FakeAuthGuard.user.codes.map((code) => ({ permission: { code } })),
      ),
    },
    deposit: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id: string; companyId: string } }) => {
        if (!depositFixture) return null;
        if (depositFixture.id !== where.id || where.companyId !== COMPANY_A) return null;
        return { ...depositFixture };
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (!depositFixture || depositFixture.id !== where.id) return null;
        return { ...depositFixture, contract: null, reservation: null, proofDocument: null, reviewedBy: null };
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        if (depositFixture && depositFixture.id === where.id) {
          Object.assign(depositFixture, data);
        }
        return { ...depositFixture, ...data, contract: { customerId: null } };
      }),
    },
    paymentCorrection: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `corr-${Date.now()}`, ...data };
        createdCorrections.push(row);
        return row;
      }),
    },
    installment: {
      update: jest.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        createdAuditLogs.push(data);
        return { id: 'audit-1', ...data };
      }),
    },
    $transaction: jest.fn().mockImplementation(async (fn: unknown) => {
      if (typeof fn === 'function') {
        return fn({
          deposit: m.deposit,
          paymentCorrection: m.paymentCorrection,
          installment: m.installment,
          auditLog: m.auditLog,
        });
      }
      return fn;
    }),
  };
  return m;
}

// ── Test suite ────────────────────────────────────────────────────────────────

let mock = makePrismaMock();

describe('Deposits · reverseDeposit + FG-06', () => {
  let app: INestApplication;
  const documentsMock = {
    create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    presign: jest.fn().mockResolvedValue({ url: 'https://presign.example/' }),
  };

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: mock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), MockPrismaModule, DepositsModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_INTERCEPTOR, useClass: FakeTenantInterceptor },
      ],
    })
      .overrideProvider(DocumentsService)
      .useValue(documentsMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    FakeAuthGuard.user = {
      sub: ADMIN_ID,
      role: UserRole.ADMIN,
      codes: ['deposits:reverse', 'deposits:verify', 'deposits:read'],
    };
  });

  afterAll(() => app.close());

  beforeEach(() => {
    depositFixture = makeApprovedDeposit();
    createdCorrections.length = 0;
    createdAuditLogs.length = 0;
    mock.deposit.findFirst.mockClear();
    mock.paymentCorrection.create.mockClear();
    mock.installment.update.mockClear();
    mock.auditLog.create.mockClear();
  });

  // ── deposits:reverse endpoint ─────────────────────────────────────────────

  describe('POST /deposits/:id/reverse', () => {
    it('returns 201 on a valid APPROVED deposit with PAID installment', async () => {
      await request(app.getHttpServer())
        .post(`/deposits/${DEP_ID}/reverse`)
        .send({ reason: 'Data entry error — wrong installment linked' })
        .expect(201);
    });

    it('returns 404 when deposit does not belong to this tenant', async () => {
      depositFixture = null;
      await request(app.getHttpServer())
        .post(`/deposits/${DEP_ID}/reverse`)
        .send({ reason: 'Cross-tenant attempt' })
        .expect(404);
    });

    it('returns 400 when deposit is not APPROVED', async () => {
      depositFixture = { ...makeApprovedDeposit(), reviewStatus: DepositReviewStatus.PENDING_REVIEW };
      await request(app.getHttpServer())
        .post(`/deposits/${DEP_ID}/reverse`)
        .send({ reason: 'Not approved yet' })
        .expect(400);
    });

    it('returns 400 when deposit has no linked installment', async () => {
      depositFixture = { ...makeApprovedDeposit(), installmentId: null, installment: null };
      await request(app.getHttpServer())
        .post(`/deposits/${DEP_ID}/reverse`)
        .send({ reason: 'Deposit not linked' })
        .expect(400);
    });

    it('returns 400 when reason is missing', async () => {
      await request(app.getHttpServer())
        .post(`/deposits/${DEP_ID}/reverse`)
        .send({})
        .expect(400);
    });

    it('returns 400 when reason is empty string', async () => {
      await request(app.getHttpServer())
        .post(`/deposits/${DEP_ID}/reverse`)
        .send({ reason: '' })
        .expect(400);
    });

    it('writes one PaymentCorrection(REVERSAL) in the transaction', async () => {
      await request(app.getHttpServer())
        .post(`/deposits/${DEP_ID}/reverse`)
        .send({ reason: 'Admin correction' })
        .expect(201);

      expect(mock.paymentCorrection.create).toHaveBeenCalledTimes(1);
      const args = mock.paymentCorrection.create.mock.calls[0]![0] as {
        data: { type: string; depositId: string; sourceInstallmentId: string; reason: string; performedById: string; companyId: string };
      };
      expect(args.data.type).toBe('REVERSAL');
      expect(args.data.depositId).toBe(DEP_ID);
      expect(args.data.sourceInstallmentId).toBe(INST_ID);
      expect(args.data.reason).toBe('Admin correction');
      expect(args.data.performedById).toBe(ADMIN_ID);
      expect(args.data.companyId).toBe(COMPANY_A);
    });

    it('reopens the installment as PENDING via installment.update', async () => {
      await request(app.getHttpServer())
        .post(`/deposits/${DEP_ID}/reverse`)
        .send({ reason: 'Admin correction' })
        .expect(201);

      expect(mock.installment.update).toHaveBeenCalledTimes(1);
      const args = mock.installment.update.mock.calls[0]![0] as {
        where: { id: string };
        data: { status: string; lastCorrectionId: string; paidAt?: unknown };
      };
      expect(args.where.id).toBe(INST_ID);
      expect(args.data.status).toBe('PENDING');
      // Hard Rule 2: paidAt MUST NOT appear in the update data
      expect(args.data.paidAt).toBeUndefined();
    });

    it('writes an AuditLog entry with action=deposit.reversed and correct payload', async () => {
      await request(app.getHttpServer())
        .post(`/deposits/${DEP_ID}/reverse`)
        .send({ reason: 'Manual override' })
        .expect(201);

      expect(createdAuditLogs).toHaveLength(1);
      const log = createdAuditLogs[0]!;
      expect(log.action).toBe('deposit.reversed');
      expect(log.entityType).toBe('Deposit');
      expect(log.entityId).toBe(DEP_ID);
      const after = log.after as Record<string, unknown>;
      expect(after.installmentPreviousStatus).toBe('PAID');
      expect(after.installmentNewStatus).toBe('PENDING');
      // paidAt was 2026-09-01 — MUST appear as preserved (non-null)
      expect(after.installmentPaidAtPreserved).toBeTruthy();
      expect(after.reason).toBe('Manual override');
    });

    it('requires deposits:reverse permission (returns 403 without it)', async () => {
      FakeAuthGuard.user = {
        sub: ADMIN_ID,
        role: UserRole.ADMIN,
        codes: ['deposits:read'],  // missing deposits:reverse
      };
      await request(app.getHttpServer())
        .post(`/deposits/${DEP_ID}/reverse`)
        .send({ reason: 'Attempt without permission' })
        .expect(403);

      FakeAuthGuard.user = {
        sub: ADMIN_ID,
        role: UserRole.ADMIN,
        codes: ['deposits:reverse', 'deposits:verify', 'deposits:read'],
      };
    });
  });

  // ── FG-06: verify(false) on APPROVED+PAID → reversal path ────────────────

  describe('FG-06 — verify(false) on APPROVED deposit with PAID installment', () => {
    it('writes a PaymentCorrection(REVERSAL) instead of leaving installment PAID', async () => {
      await request(app.getHttpServer())
        .patch(`/deposits/${DEP_ID}/verify`)
        .send({ verified: false })
        .expect(200);

      expect(mock.paymentCorrection.create).toHaveBeenCalledTimes(1);
      const args = mock.paymentCorrection.create.mock.calls[0]![0] as {
        data: { type: string; depositId: string; sourceInstallmentId: string };
      };
      expect(args.data.type).toBe('REVERSAL');
      expect(args.data.depositId).toBe(DEP_ID);
      expect(args.data.sourceInstallmentId).toBe(INST_ID);
    });

    it('reopens installment as PENDING without clearing paidAt', async () => {
      await request(app.getHttpServer())
        .patch(`/deposits/${DEP_ID}/verify`)
        .send({ verified: false })
        .expect(200);

      expect(mock.installment.update).toHaveBeenCalledTimes(1);
      const args = mock.installment.update.mock.calls[0]![0] as {
        data: { status: string; paidAt?: unknown };
      };
      expect(args.data.status).toBe('PENDING');
      expect(args.data.paidAt).toBeUndefined();
    });

    it('writes AuditLog with deposit.reversed action', async () => {
      await request(app.getHttpServer())
        .patch(`/deposits/${DEP_ID}/verify`)
        .send({ verified: false })
        .expect(200);

      expect(createdAuditLogs).toHaveLength(1);
      expect(createdAuditLogs[0]!.action).toBe('deposit.reversed');
    });

    it('does NOT route through reversal path when deposit is NOT APPROVED', async () => {
      depositFixture = {
        ...makeApprovedDeposit(),
        reviewStatus: DepositReviewStatus.PENDING_REVIEW,
        verified: false,
      };
      await request(app.getHttpServer())
        .patch(`/deposits/${DEP_ID}/verify`)
        .send({ verified: false })
        .expect(200);

      expect(mock.paymentCorrection.create).not.toHaveBeenCalled();
    });

    it('does NOT route through reversal path when verify=true', async () => {
      depositFixture = {
        ...makeApprovedDeposit(),
        reviewStatus: DepositReviewStatus.PENDING_REVIEW,
        verified: false,
      };
      await request(app.getHttpServer())
        .patch(`/deposits/${DEP_ID}/verify`)
        .send({ verified: true })
        .expect(200);

      expect(mock.paymentCorrection.create).not.toHaveBeenCalled();
    });
  });
});
