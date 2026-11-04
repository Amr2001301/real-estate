import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/contracts/data/dtos/contract_dto.dart';
import 'package:mobile_customer/features/contracts/data/mappers/contract_mapper.dart';
import 'package:mobile_customer/features/contracts/domain/entities/contract_statement.dart';
import 'package:mobile_customer/features/contracts/presentation/contract_detail_sections.dart';
import 'package:mobile_customer/features/contracts/presentation/contract_money.dart';
import 'package:mobile_customer/features/deposits/data/dtos/deposit_dto.dart';
import 'package:mobile_customer/features/deposits/data/mappers/deposit_mapper.dart';
import 'package:mobile_customer/features/installments/domain/entities/installment.dart';

/// The contract page shows the price, the plan and the next installment as
/// the website does; the payment page shows how and when it was paid.

ContractStatement _statement({double value = 1000000, double fees = 0, double paid = 250000}) => ContractStatement(
      asOf: DateTime(2026, 11, 4),
      lines: const [],
      contractValue: value,
      fees: fees,
      paid: paid,
      balance: value + fees - paid,
      overdue: 0,
      dueToday: 0,
      upcoming: 0,
      awaiting: 0,
      awaitingCount: 0,
    );

Installment _row(String id, DateTime due, InstallmentStatus status, {String contract = 'c1'}) =>
    Installment(id: id, amount: '1000', dueDate: due, status: status, type: InstallmentPaymentType.installment, contractId: contract);

void main() {
  test('a contract carries its price, down payment and plan (money as strings or numbers)', () {
    final c = ContractDto.fromJson({
      'id': 'c1',
      'signedAt': '2026-01-10T00:00:00.000Z',
      'unit': {'code': 'A-1', 'type': 'APARTMENT'},
      'totalAmount': '4640000.00',
      'downPayment': 464000,
      'installmentPlan': {'totalMonths': 84, 'monthlyAmount': '49714.29', 'startsAt': '2026-02-01T00:00:00.000Z', 'frequency': 'QUARTERLY'},
    }).toEntity();
    expect(c.totalAmount, 4640000);
    expect(c.downPayment, 464000);
    expect(c.plan!.totalMonths, 84);
    expect(c.plan!.monthlyAmount, closeTo(49714.29, 0.001));
    expect(c.plan!.frequency, 'QUARTERLY');
    expect(c.plan!.startsAt, DateTime.utc(2026, 2, 1));
  });

  test('a cash contract has no plan', () {
    final c = ContractDto.fromJson({'id': 'c2', 'unit': {'code': 'V-1', 'type': 'VILLA'}, 'totalAmount': 1000000}).toEntity();
    expect(c.plan, isNull);
    expect(c.totalAmount, 1000000);
  });

  test('the paid share is what was paid over the value and fees, capped at 100%', () {
    expect(paidShare(_statement()), 0.25);
    expect(paidShare(_statement(fees: 250000, paid: 625000)), 0.5);
    expect(paidShare(_statement(paid: 2000000)), 1);
    expect(paidShare(_statement(value: 0, paid: 0)), 0);
  });

  test("the next installment is the contract's earliest one still to pay", () {
    final rows = [
      _row('paid', DateTime(2026, 1, 1), InstallmentStatus.paid),
      _row('later', DateTime(2026, 3, 1), InstallmentStatus.pending),
      _row('late', DateTime(2026, 2, 1), InstallmentStatus.overdue),
      _row('replaced', DateTime(2026, 1, 15), InstallmentStatus.cancelled),
      _row('other', DateTime(2025, 12, 1), InstallmentStatus.pending, contract: 'c9'),
    ];
    expect(nextDueOf(rows, 'c1').map((i) => i.id), ['late', 'later']);
  });

  test('a payment carries its method, review, the row it paid and whether a proof was sent', () {
    final d = DepositDto.fromJson({
      'id': 'd1',
      'type': 'INSTALLMENT',
      'amount': '113222.22',
      'verified': false,
      'state': 'REJECTED',
      'paymentMethod': 'BANK_TRANSFER',
      'reviewStatus': 'REJECTED',
      'rejectionReason': 'الصورة غير واضحة',
      'reviewedAt': '2026-11-02T10:00:00.000Z',
      'createdAt': '2026-11-01T09:00:00.000Z',
      'paidAt': '2026-11-01T00:00:00.000Z',
      'contract': {'contractNumber': 'CT-8', 'unit': {'code': 'B-302'}},
      'installment': {'dueDate': '2026-11-01T00:00:00.000Z'},
      'proofDocument': {'id': 'doc1'},
    }).toEntity();
    expect(d.paymentMethod, 'BANK_TRANSFER');
    expect(d.rejectionReason, 'الصورة غير واضحة');
    expect(d.installmentDueDate, DateTime.utc(2026, 11, 1));
    expect(d.hasProof, isTrue);
    expect(d.collected, isFalse);
    expect(d.unitCode, 'B-302');
  });

  test("a booking payment takes its unit and number from the booking", () {
    final d = DepositDto.fromJson({
      'id': 'd2',
      'type': 'BOOKING_AMOUNT',
      'amount': 100000,
      'verified': true,
      'reservation': {'reservationNumber': 'R-12', 'unit': {'code': 'A-101'}},
    }).toEntity();
    expect(d.reservationNumber, 'R-12');
    expect(d.unitCode, 'A-101');
    expect(d.hasProof, isFalse);
  });
}
