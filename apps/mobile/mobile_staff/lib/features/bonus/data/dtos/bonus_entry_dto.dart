// Wire shape for /bonus-entries. Data layer only.
class BonusEntryDto {
  const BonusEntryDto({
    required this.id,
    required this.amount,
    required this.period,
    required this.status,
    this.ruleName,
    this.commissionPct,
    this.paidAt,
    this.createdAt,
  });

  final String id;
  final String amount;
  final String period;
  final String status;
  final String? ruleName;
  final String? commissionPct;
  final String? paidAt;
  final String? createdAt;

  factory BonusEntryDto.fromJson(Map<String, dynamic> json) => BonusEntryDto(
        id: json['id'] as String,
        amount: json['amount']?.toString() ?? '0',
        period: json['period'] as String? ?? '',
        status: json['status'] as String? ?? 'PENDING',
        ruleName: (json['rule'] as Map<String, dynamic>?)?['name'] as String?,
        commissionPct: json['commissionPct']?.toString(),
        paidAt: json['paidAt'] as String?,
        createdAt: json['createdAt'] as String?,
      );
}
