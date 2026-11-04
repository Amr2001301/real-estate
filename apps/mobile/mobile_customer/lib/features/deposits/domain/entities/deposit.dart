import 'package:core/core_domain.dart';

/// Type of payment a deposit records (matches backend DepositType).
enum DepositType {
  bookingAmount('BOOKING_AMOUNT'),
  downPayment('DOWN_PAYMENT'),
  installment('INSTALLMENT'),
  finalPayment('FINAL_PAYMENT'),

  /// A fee or penalty (late fee, bounced cheque, transfer) — not the price.
  fee('FEE'),
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
    this.paymentMethod,
    this.reviewStatus,
    this.rejectionReason,
    this.reviewedAt,
    this.createdAt,
    this.installmentDueDate,
    this.reservationNumber,
    this.hasProof = false,
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

  /// CASH, BANK_TRANSFER, CHEQUE, CARD, … as recorded.
  final String? paymentMethod;

  /// The proof's review: PENDING, APPROVED, REJECTED (or none when recorded
  /// by the company).
  final String? reviewStatus;
  final String? rejectionReason;
  final DateTime? reviewedAt;

  /// When the payment was sent or recorded.
  final DateTime? createdAt;

  /// The schedule row it paid, when it paid one.
  final DateTime? installmentDueDate;

  /// The booking it paid, for a booking payment.
  final String? reservationNumber;

  /// The customer sent a proof for it (a payment the company recorded itself
  /// has none).
  final bool hasProof;

  /// Counts as paid: collected — not a proof under review, a rejected one, a
  /// reversed payment or a returned cheque. An older API without `state`
  /// falls back to `verified`.
  bool get collected => state != null ? state == 'COLLECTED' : verified;

  @override
  List<Object?> get props => [id, amount, type, verified, paidAt, state, paymentMethod, reviewStatus, rejectionReason,
        reviewedAt, createdAt, installmentDueDate, reservationNumber, hasProof];
}
