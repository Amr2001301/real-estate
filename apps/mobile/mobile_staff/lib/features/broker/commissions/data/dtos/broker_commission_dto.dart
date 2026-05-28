// Wire shape for /portal/commissions. Data layer only.
class BrokerCommissionDto {
  const BrokerCommissionDto({
    required this.id,
    required this.status,
    this.grossAmount,
    this.netAmount,
    this.projectName,
    this.createdAt,
  });

  final String id;
  final String status;
  final String? grossAmount;
  final String? netAmount;
  final String? projectName;
  final String? createdAt;

  factory BrokerCommissionDto.fromJson(Map<String, dynamic> json) {
    final project = json['project'] as Map<String, dynamic>?;
    final name = project?['name'];
    return BrokerCommissionDto(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'PENDING',
      grossAmount: json['grossAmount']?.toString(),
      netAmount: json['netAmount']?.toString(),
      projectName: name is Map ? name['en'] as String? : name as String?,
      createdAt: json['createdAt'] as String?,
    );
  }
}
