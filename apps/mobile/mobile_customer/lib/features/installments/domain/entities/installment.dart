import 'package:core/core_domain.dart';

/// Installment status mirrored from the backend `InstallmentStatus` enum.
enum InstallmentStatus {
  pending('PENDING'),
  paid('PAID'),
  overdue('OVERDUE'),
  unknown('');

  const InstallmentStatus(this.wire);
  final String wire;

  static InstallmentStatus fromWire(String? wire) => values.firstWhere(
        (s) => s.wire == wire,
        orElse: () => InstallmentStatus.unknown,
      );
}

/// Plan payment type — drives the "Down payment / Installment / Final payment"
/// copy in the UI.
enum InstallmentPaymentType {
  downPayment('DOWN_PAYMENT'),
  installment('INSTALLMENT'),
  finalPayment('FINAL_PAYMENT'),
  unknown('');

  const InstallmentPaymentType(this.wire);
  final String wire;

  static InstallmentPaymentType fromWire(String? wire) => values.firstWhere(
        (t) => t.wire == wire,
        orElse: () => InstallmentPaymentType.unknown,
      );
}

/// Payment-proof review state on the latest Deposit for this installment.
/// Customer-visible — mirrors backend `DepositReviewStatus`.
enum PaymentProofStatus {
  noProof('NO_PROOF'),
  pendingReview('PENDING_REVIEW'),
  approved('APPROVED'),
  rejected('REJECTED'),
  unknown('');

  const PaymentProofStatus(this.wire);
  final String wire;

  static PaymentProofStatus fromWire(String? wire) => values.firstWhere(
        (s) => s.wire == wire,
        orElse: () => PaymentProofStatus.unknown,
      );
}

/// Manual / offline payment methods only — no online payments are part of
/// the customer flow. Mirrors backend `PaymentMethod`.
enum PaymentMethod {
  cash('CASH'),
  bankTransfer('BANK_TRANSFER'),
  cheque('CHEQUE'),
  other('OTHER'),
  unknown('');

  const PaymentMethod(this.wire);
  final String wire;

  static PaymentMethod fromWire(String? wire) => values.firstWhere(
        (m) => m.wire == wire,
        orElse: () => PaymentMethod.unknown,
      );
}

/// Latest payment proof linked to an installment (when present). Carries
/// only fields the customer is allowed to see; NO storage URL — receipts
/// are reached exclusively via the signed-download endpoint.
class PaymentProofSummary extends Equatable {
  const PaymentProofSummary({
    required this.depositId,
    required this.reviewStatus,
    this.paymentMethod,
    this.rejectionReason,
    this.submittedAt,
  });

  final String depositId;
  final PaymentProofStatus reviewStatus;
  final PaymentMethod? paymentMethod;
  final String? rejectionReason;
  final DateTime? submittedAt;

  @override
  List<Object?> get props => [
        depositId,
        reviewStatus,
        paymentMethod,
        rejectionReason,
        submittedAt,
      ];
}

/// A single installment in the customer's contract schedule. Domain entity.
/// `amount` stays a raw decimal-as-string from the API; format only at the
/// edge.
class Installment extends Equatable {
  const Installment({
    required this.id,
    required this.amount,
    required this.dueDate,
    required this.status,
    required this.type,
    this.paidAt,
    this.contractId,
    this.contractNumber,
    this.unitCode,
    this.unitType,
    this.projectNameAr,
    this.projectNameEn,
    this.latestProof,
  });

  final String id;
  final String amount;
  final DateTime dueDate;
  final InstallmentStatus status;
  final InstallmentPaymentType type;
  final DateTime? paidAt;
  final String? contractId;
  final String? contractNumber;
  final String? unitCode;
  final String? unitType;
  final String? projectNameAr;
  final String? projectNameEn;

  /// `null` until the customer has submitted at least one proof for this
  /// installment.
  final PaymentProofSummary? latestProof;

  /// True when the installment is not yet paid AND no proof is currently
  /// under review. Used to gate the "Submit proof" CTA.
  bool get canSubmitProof =>
      status != InstallmentStatus.paid &&
      (latestProof == null ||
          latestProof!.reviewStatus == PaymentProofStatus.noProof ||
          latestProof!.reviewStatus == PaymentProofStatus.rejected);

  /// True only when a proof exists and is currently REJECTED — drives the
  /// "Resubmit" button vs first-time "Submit" copy.
  bool get isResubmit =>
      latestProof?.reviewStatus == PaymentProofStatus.rejected;

  @override
  List<Object?> get props => [
        id,
        amount,
        dueDate,
        status,
        type,
        paidAt,
        contractId,
        latestProof,
      ];
}
