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
  });

  final String id;
  final String amount;
  final String type;
  final bool verified;
  final String? paidAt;
  final String? contractNumber;
  final String? unitCode;

  factory DepositDto.fromJson(Map<String, dynamic> json) {
    final contract = json['contract'] as Map<String, dynamic>?;
    final unit = contract?['unit'] as Map<String, dynamic>?;
    return DepositDto(
      id: json['id'] as String,
      amount: json['amount']?.toString() ?? '',
      type: json['type'] as String? ?? '',
      verified: json['verified'] as bool? ?? false,
      paidAt: json['paidAt'] as String?,
      contractNumber: contract?['contractNumber'] as String?,
      unitCode: unit?['code'] as String?,
    );
  }
}
