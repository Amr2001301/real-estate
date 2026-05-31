import 'package:core/core_domain.dart';

/// Manual/offline payment method the customer selected when submitting proof.
/// Wire values mirror the backend `PaymentMethod` enum. No online/card data.
enum PaymentMethod {
  cash('CASH'),
  bankTransfer('BANK_TRANSFER'),
  cheque('CHEQUE'),
  other('OTHER'),
  unknown('');

  const PaymentMethod(this.wire);
  final String wire;

  static PaymentMethod fromWire(String? wire) {
    if (wire == null) return PaymentMethod.unknown;
    for (final v in PaymentMethod.values) {
      if (v.wire == wire) return v;
    }
    return PaymentMethod.unknown;
  }
}

/// Review lifecycle of a customer-submitted payment proof. Mirrors the backend
/// `DepositReviewStatus` enum.
enum PaymentReviewStatus {
  noProof('NO_PROOF'),
  pendingReview('PENDING_REVIEW'),
  approved('APPROVED'),
  rejected('REJECTED'),
  unknown('');

  const PaymentReviewStatus(this.wire);
  final String wire;

  static PaymentReviewStatus fromWire(String? wire) {
    if (wire == null) return PaymentReviewStatus.unknown;
    for (final v in PaymentReviewStatus.values) {
      if (v.wire == wire) return v;
    }
    return PaymentReviewStatus.unknown;
  }
}

/// A decision a reviewer can take on a pending payment proof.
enum ReviewDecision { approved, rejected }

/// A short-lived signed link to open a payment-proof document
/// (`GET /deposits/:id/proof/download`). [url] is a freshly-minted signed URL
/// used immediately to open the file — it is NOT a permanent URL and is never
/// persisted in cubit state.
class ProofDownloadLink extends Equatable {
  const ProofDownloadLink({required this.url, this.fileName, this.contentType, this.expiresIn});

  final String url;
  final String? fileName;
  final String? contentType;
  final int? expiresIn;

  @override
  List<Object?> get props => [url, fileName, contentType, expiresIn];
}

/// One customer-submitted payment proof awaiting staff review (a Deposit row
/// projected from `GET /deposits/review-queue`).
///
/// `amount` is kept as the raw decimal String from the wire and formatted only
/// at the UI edge. The proof file itself is intentionally NOT modelled as a URL:
/// the review-queue exposes proof METADATA only (there is no staff signed-
/// download endpoint), so the entity carries `proofFileName`/`hasProof` and the
/// UI shows a "proof attached" affordance rather than opening a file.
class PaymentReviewItem extends Equatable {
  const PaymentReviewItem({
    required this.id,
    required this.amount,
    required this.reviewStatus,
    this.paymentMethod = PaymentMethod.unknown,
    this.paidAt,
    this.submittedAt,
    this.dueDate,
    this.customerName,
    this.contractNumber,
    this.unitCode,
    this.installmentType,
    this.hasProof = false,
    this.proofFileName,
  });

  /// Deposit id — the target of approve/reject.
  final String id;
  final String amount;
  final PaymentReviewStatus reviewStatus;
  final PaymentMethod paymentMethod;
  final DateTime? paidAt;
  final DateTime? submittedAt;
  final DateTime? dueDate;
  final String? customerName;
  final String? contractNumber;
  final String? unitCode;

  /// Wire value of the installment type (DOWN_PAYMENT/INSTALLMENT/...), or null.
  final String? installmentType;

  /// Whether a proof document is attached (metadata only — no openable URL).
  final bool hasProof;
  final String? proofFileName;

  @override
  List<Object?> get props => [
        id,
        amount,
        reviewStatus,
        paymentMethod,
        paidAt,
        submittedAt,
        dueDate,
        customerName,
        contractNumber,
        unitCode,
        installmentType,
        hasProof,
        proofFileName,
      ];
}
