import {
  InstallmentStatus,
  PlanPaymentType,
  ReservationBookingPaymentStatus,
} from '@prisma/client';
import { buildStatement, StatementInput } from '../contract-statement';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

const row = (
  id: string,
  type: PlanPaymentType,
  amount: number,
  due: string,
  status: InstallmentStatus,
  paidAt: string | null = null,
): StatementInput['installments'][number] => ({
  id,
  type,
  amount,
  dueDate: d(due),
  status,
  paidAt: paidAt ? d(paidAt) : null,
  waivedAt: null,
});

const dep = (
  id: string,
  installmentId: string | null,
  amount: number,
  paidAt: string,
  state: StatementInput['deposits'][number]['state'],
  extra: Partial<StatementInput['deposits'][number]> = {},
): StatementInput['deposits'][number] => ({
  id,
  type: 'INSTALLMENT',
  installmentId,
  amount,
  paidAt: d(paidAt),
  paymentMethod: 'CASH',
  paymentInstrument: null,
  state,
  reversedAt: null,
  reversalReason: null,
  reversedBy: null,
  ...extra,
});

describe('buildStatement', () => {
  const base: StatementInput = {
    totalAmount: 1000,
    signedAt: d('2026-01-01'),
    createdAt: d('2026-01-01'),
    preSystem: false,
    reservation: {
      bookingAmount: 100,
      bookingPaymentStatus: ReservationBookingPaymentStatus.PAID,
      bookingPaidAt: d('2025-12-20'),
      createdAt: d('2025-12-20'),
    },
    installments: [
      row(
        'dp',
        PlanPaymentType.DOWN_PAYMENT,
        300,
        '2026-01-01',
        InstallmentStatus.PAID,
        '2026-01-01',
      ),
      row('i1', PlanPaymentType.INSTALLMENT, 200, '2026-02-01', InstallmentStatus.PENDING),
      row('i2', PlanPaymentType.INSTALLMENT, 200, '2026-03-01', InstallmentStatus.PENDING),
      row('i3', PlanPaymentType.INSTALLMENT, 200, '2026-04-01', InstallmentStatus.PENDING),
      row('fee', PlanPaymentType.LATE_FEE, 20, '2026-02-10', InstallmentStatus.PENDING),
      row('waived', PlanPaymentType.LATE_FEE, 50, '2026-02-11', InstallmentStatus.CANCELLED),
    ],
    deposits: [
      dep('d-dp', 'dp', 300, '2026-01-01', 'COLLECTED'),
      dep('d-i1', 'i1', 200, '2026-02-01', 'REVERSED', {
        reversedAt: d('2026-02-05'),
        reversalReason: 'cheque entered twice',
        reversedBy: 'Admin',
      }),
      dep('d-i2', 'i2', 200, '2026-02-28', 'PENDING_REVIEW'),
    ],
  };

  const s = buildStatement(base, '2026-03-01');

  it('opens with the contract value and closes on what is left', () => {
    expect(s.lines[0]).toMatchObject({
      kind: 'PAYMENT',
      rowType: 'BOOKING',
      unrecorded: true,
      credit: '100.00',
    });
    expect(s.lines.find((l) => l.kind === 'CONTRACT')).toMatchObject({ debit: '1000.00' });
    // 1000 + 20 fee − 100 booking − 300 down payment (the reversed 200 nets out).
    expect(s.totals).toMatchObject({
      contractValue: '1000.00',
      fees: '20.00',
      paid: '400.00',
      balance: '620.00',
    });
    expect(s.lines[s.lines.length - 1]!.balance).toBe('620.00');
  });

  it('shows a reversal as its own line with the reason and who did it', () => {
    const rev = s.lines.find((l) => l.kind === 'REVERSAL')!;
    expect(rev).toMatchObject({
      date: '2026-02-05',
      debit: '200.00',
      reason: 'cheque entered twice',
      by: 'Admin',
    });
    expect(s.lines.filter((l) => l.depositId === 'd-i1')).toHaveLength(2);
  });

  it('keeps proofs under review out of the balance', () => {
    expect(s.totals.awaiting).toBe('200.00');
    expect(s.awaiting).toEqual([
      expect.objectContaining({ depositId: 'd-i2', state: 'PENDING_REVIEW' }),
    ]);
    expect(s.lines.some((l) => l.depositId === 'd-i2')).toBe(false);
  });

  it('splits the open rows into overdue / due today / upcoming', () => {
    // i1 (Feb 1) and the fee (Feb 10) are late; i2 falls due today; i3 later.
    expect(s.totals).toMatchObject({
      overdue: '220.00',
      dueToday: '200.00',
      upcoming: '200.00',
      openFees: '20.00',
    });
    // 620 left = 220 + 200 + 200: nothing owed outside the schedule.
    expect(s.totals.unscheduled).toBe('0.00');
  });

  it('shows value with no schedule row and no payment as unscheduled', () => {
    const noDown = buildStatement({ ...base, totalAmount: 1500 }, '2026-03-01');
    expect(noDown.totals.unscheduled).toBe('500.00');
  });

  it('skips a waived fee', () => {
    expect(s.lines.some((l) => l.kind === 'FEE' && l.debit === '50.00')).toBe(false);
  });

  it('credits a booking waived on the reservation, and counts an unpaid one as late', () => {
    const waived = buildStatement(
      {
        ...base,
        reservation: {
          ...base.reservation!,
          bookingPaymentStatus: ReservationBookingPaymentStatus.WAIVED,
        },
      },
      '2026-03-01',
    );
    expect(waived.lines.find((l) => l.kind === 'WAIVER')).toMatchObject({ credit: '100.00' });
    const unpaid = buildStatement(
      {
        ...base,
        reservation: {
          ...base.reservation!,
          bookingPaymentStatus: ReservationBookingPaymentStatus.UNPAID,
        },
      },
      '2026-03-01',
    );
    expect(unpaid.totals.overdue).toBe('320.00');
    expect(unpaid.totals.balance).toBe('720.00');
  });
});
