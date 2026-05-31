// Wire shape for a `GET /deposits/review-queue` item. Data layer only — no
// domain or Flutter imports. Parsing only; date strings are parsed in the mapper.

class PaymentReviewDto {
  const PaymentReviewDto({
    required this.id,
    required this.amount,
    required this.reviewStatus,
    this.paymentMethod,
    this.paidAt,
    this.createdAt,
    this.dueDate,
    this.customerName,
    this.contractNumber,
    this.unitCode,
    this.installmentType,
    this.proofFileName,
    this.hasProof = false,
  });

  final String id;
  final String amount;
  final String reviewStatus;
  final String? paymentMethod;
  final String? paidAt;
  final String? createdAt;
  final String? dueDate;
  final String? customerName;
  final String? contractNumber;
  final String? unitCode;
  final String? installmentType;
  final String? proofFileName;
  final bool hasProof;

  factory PaymentReviewDto.fromJson(Map<String, dynamic> json) {
    final contract = json['contract'] as Map<String, dynamic>?;
    final contractCustomer = contract?['customer'] as Map<String, dynamic>?;
    final contractUnit = contract?['unit'] as Map<String, dynamic>?;
    final reservation = json['reservation'] as Map<String, dynamic>?;
    final reservationClient = reservation?['client'] as Map<String, dynamic>?;
    final reservationLead = reservation?['lead'] as Map<String, dynamic>?;
    final reservationUnit = reservation?['unit'] as Map<String, dynamic>?;
    final installment = json['installment'] as Map<String, dynamic>?;
    final proof = json['proofDocument'] as Map<String, dynamic>?;

    return PaymentReviewDto(
      id: json['id'] as String,
      // Decimal arrives as a String (or occasionally a num) — normalise to String.
      amount: (json['amount'] ?? '').toString(),
      reviewStatus: json['reviewStatus'] as String? ?? 'PENDING_REVIEW',
      paymentMethod: json['paymentMethod'] as String?,
      paidAt: json['paidAt'] as String?,
      createdAt: json['createdAt'] as String?,
      dueDate: installment?['dueDate'] as String?,
      customerName: (contractCustomer?['fullName'] as String?) ??
          (reservationClient?['fullName'] as String?) ??
          (reservationLead?['fullName'] as String?),
      contractNumber: contract?['contractNumber'] as String?,
      unitCode: (contractUnit?['code'] as String?) ?? (reservationUnit?['code'] as String?),
      installmentType: installment?['type'] as String?,
      proofFileName: proof?['fileName'] as String?,
      hasProof: proof != null,
    );
  }

  /// Parse the paginated `{ data: [...], meta: {...} }` envelope, taking the
  /// `data` array only (the staff queue is rendered as a single page).
  static List<PaymentReviewDto> listFromEnvelope(Map<String, dynamic>? body) {
    final data = (body?['data'] as List?) ?? const [];
    return data.whereType<Map<String, dynamic>>().map(PaymentReviewDto.fromJson).toList();
  }
}
