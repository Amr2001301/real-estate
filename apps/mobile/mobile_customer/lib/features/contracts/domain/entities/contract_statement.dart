import 'package:core/core_domain.dart';

/// One movement on a statement of account: the contract value, a fee, a
/// payment, a reversed payment or a waived fee — with the balance after it.
class StatementLine extends Equatable {
  const StatementLine({
    required this.date,
    required this.kind,
    this.rowType,
    this.rowDueDate,
    this.method,
    this.unrecorded = false,
    required this.debit,
    required this.credit,
    required this.balance,
    this.reason,
  });

  final DateTime date;

  /// CONTRACT, FEE, PAYMENT, REVERSAL or WAIVER.
  final String kind;

  /// Schedule row type the line belongs to (INSTALLMENT, DOWN_PAYMENT, …, BOOKING).
  final String? rowType;
  final DateTime? rowDueDate;

  /// Payment method (CASH, BANK_TRANSFER, CHEQUE, …).
  final String? method;

  /// Marked paid with no payment recorded behind it.
  final bool unrecorded;
  final double debit;
  final double credit;
  final double balance;

  /// Why a payment was reversed.
  final String? reason;

  @override
  List<Object?> get props => [date, kind, rowType, rowDueDate, method, unrecorded, debit, credit, balance, reason];
}

/// The customer's statement of account (كشف حساب) for one contract — the
/// same figures staff see on the contract page.
class ContractStatement extends Equatable {
  const ContractStatement({
    required this.asOf,
    required this.lines,
    required this.contractValue,
    required this.fees,
    required this.paid,
    required this.balance,
    required this.overdue,
    required this.dueToday,
    required this.upcoming,
    required this.awaiting,
    required this.awaitingCount,
  });

  final DateTime asOf;
  final List<StatementLine> lines;
  final double contractValue;
  final double fees;
  final double paid;
  final double balance;
  final double overdue;
  final double dueToday;
  final double upcoming;

  /// Payments sent but not confirmed yet (a proof under review, a cheque not cleared).
  final double awaiting;
  final int awaitingCount;

  @override
  List<Object?> get props =>
      [asOf, lines, contractValue, fees, paid, balance, overdue, dueToday, upcoming, awaiting, awaitingCount];
}
