// Customer-facing /me/deposits row, narrowed to what we need to enrich
// installments with proof state. Data layer only.
//
// We deliberately ignore `receiptUrl` here — it's redacted to null on the
// server anyway (P7+P11 security audit) and the mobile UI must download
// proof files via the existing signed-download endpoint, not directly.
class ProofDepositDto {
  const ProofDepositDto({
    required this.id,
    required this.installmentId,
    required this.reviewStatus,
    this.paymentMethod,
    this.rejectionReason,
    this.paidAt,
    this.createdAt,
  });

  final String id;
  final String? installmentId;
  final String reviewStatus;
  final String? paymentMethod;
  final String? rejectionReason;
  final String? paidAt;
  final String? createdAt;

  factory ProofDepositDto.fromJson(Map<String, dynamic> json) {
    final installment = json['installment'] as Map<String, dynamic>?;
    return ProofDepositDto(
      id: json['id'] as String,
      installmentId: installment?['id'] as String?,
      reviewStatus: json['reviewStatus'] as String? ?? 'NO_PROOF',
      paymentMethod: json['paymentMethod'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      paidAt: json['paidAt'] as String?,
      createdAt: json['createdAt'] as String?,
    );
  }
}
