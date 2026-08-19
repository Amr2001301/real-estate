class StaffDepositDto {
  const StaffDepositDto({
    required this.id,
    this.amount,
    this.type,
    this.verified,
    this.reviewStatus,
    this.paidAt,
    this.contractNumber,
    this.customerName,
    this.unitCode,
    this.installmentDueDate,
  });

  final String id;
  final double? amount;
  final String? type;
  final bool? verified;
  final String? reviewStatus;
  final String? paidAt;
  final String? contractNumber;
  final String? customerName;
  final String? unitCode;
  final String? installmentDueDate;

  factory StaffDepositDto.fromJson(Map<String, dynamic> json) {
    final contract = json['contract'] as Map<String, dynamic>?;
    final customer = contract?['customer'] as Map<String, dynamic>?;
    final unit = contract?['unit'] as Map<String, dynamic>?;
    final installment = json['installment'] as Map<String, dynamic>?;
    return StaffDepositDto(
      id: json['id'] as String,
      amount: (json['amount'] as num?)?.toDouble(),
      type: json['type'] as String?,
      verified: json['verified'] as bool?,
      reviewStatus: json['reviewStatus'] as String?,
      paidAt: json['paidAt'] as String?,
      contractNumber: contract?['contractNumber'] as String?,
      customerName: customer?['fullName'] as String?,
      unitCode: unit?['code'] as String?,
      installmentDueDate: installment?['dueDate'] as String?,
    );
  }
}
