import 'package:core/core_domain.dart';

/// Type of payment a deposit records (matches backend DepositType).
enum DepositType {
  bookingAmount('BOOKING_AMOUNT'),
  downPayment('DOWN_PAYMENT'),
  installment('INSTALLMENT'),
  finalPayment('FINAL_PAYMENT'),
  unknown('');

  const DepositType(this.wire);
  final String wire;

  static DepositType fromWire(String? wire) => values.firstWhere(
        (t) => t.wire == wire,
        orElse: () => DepositType.unknown,
      );
}

/// A payment the customer has made against their contract. Domain entity.
/// `amount` stays a raw string from the API; format only at the edge.
class Deposit extends Equatable {
  const Deposit({
    required this.id,
    required this.amount,
    required this.type,
    required this.verified,
    this.paidAt,
    this.contractNumber,
    this.unitCode,
    this.state,
  });

  final String id;
  final String amount;
  final DepositType type;
  final bool verified;
  final DateTime? paidAt;
  final String? contractNumber;
  final String? unitCode;

  /// Where the money stands, from the API (COLLECTED, PENDING_REVIEW,
  /// CHEQUE_PENDING, REJECTED, REVERSED, BOUNCED).
  final String? state;

  /// Counts as paid: collected — not a proof under review, a rejected one, a
  /// reversed payment or a returned cheque. An older API without `state`
  /// falls back to `verified`.
  bool get collected => state != null ? state == 'COLLECTED' : verified;

  @override
  List<Object?> get props => [id, amount, type, verified, paidAt, state];
}
