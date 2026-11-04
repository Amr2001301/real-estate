// Subset of a /me/deposits row. Data layer only. Legacy `receiptUrl` on the
// row is intentionally ignored — receipts download via the signed documents
// endpoint.
class DepositDto {
  const DepositDto({
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
  final String type;
  final bool verified;
  final String? paidAt;
  final String? contractNumber;
  final String? unitCode;

  /// Where the money stands (COLLECTED, PENDING_REVIEW, CHEQUE_PENDING,
  /// REJECTED, REVERSED, BOUNCED). Null from an older API.
  final String? state;
  final String? paymentMethod;
  final String? reviewStatus;
  final String? rejectionReason;
  final String? reviewedAt;
  final String? createdAt;
  final String? installmentDueDate;
  final String? reservationNumber;
  final bool hasProof;

  factory DepositDto.fromJson(Map<String, dynamic> json) {
    final contract = json['contract'] as Map<String, dynamic>?;
    final reservation = json['reservation'] as Map<String, dynamic>?;
    // A booking payment has no contract: its unit is the booking's.
    final unit = (contract?['unit'] ?? reservation?['unit']) as Map<String, dynamic>?;
    return DepositDto(
      id: json['id'] as String,
      amount: json['amount']?.toString() ?? '',
      type: json['type'] as String? ?? '',
      verified: json['verified'] as bool? ?? false,
      paidAt: json['paidAt'] as String?,
      contractNumber: contract?['contractNumber'] as String?,
      unitCode: unit?['code'] as String?,
      state: json['state'] as String?,
      paymentMethod: json['paymentMethod'] as String?,
      reviewStatus: json['reviewStatus'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      reviewedAt: json['reviewedAt'] as String?,
      createdAt: json['createdAt'] as String?,
      installmentDueDate: (json['installment'] as Map<String, dynamic>?)?['dueDate'] as String?,
      reservationNumber: reservation?['reservationNumber'] as String?,
      hasProof: json['proofDocument'] != null,
    );
  }
}
