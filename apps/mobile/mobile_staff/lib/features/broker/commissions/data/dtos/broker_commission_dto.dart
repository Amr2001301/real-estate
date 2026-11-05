// Wire shape for /portal/commissions. Data layer only.
class BrokerCommissionDto {
  const BrokerCommissionDto({
    required this.id,
    required this.status,
    this.grossAmount,
    this.netAmount,
    this.projectName,
    this.createdAt,
    this.number,
    this.contractId,
    this.contractNumber,
    this.clientName,
    this.basisAmount,
    this.commissionPct,
    this.earnedAt,
    this.payoutId,
  });

  final String id;
  final String status;
  final String? grossAmount;
  final String? netAmount;
  final String? projectName;
  final String? createdAt;
  final String? number;
  final String? contractId;
  final String? contractNumber;
  final String? clientName;
  final String? basisAmount;
  final String? commissionPct;
  final String? earnedAt;
  final String? payoutId;

  factory BrokerCommissionDto.fromJson(Map<String, dynamic> json) {
    final project = json['project'] as Map<String, dynamic>?;
    final name = project?['name'];
    return BrokerCommissionDto(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'PENDING',
      grossAmount: json['grossAmount']?.toString(),
      netAmount: json['netAmount']?.toString(),
      projectName: name is Map ? ((name['ar'] as String?) ?? (name['en'] as String?)) : name as String?,
      createdAt: json['createdAt'] as String?,
      number: json['commissionNumber'] as String?,
      contractId: json['contractId'] as String?,
      contractNumber: (json['contract'] as Map<String, dynamic>?)?['contractNumber'] as String?,
      clientName: ((json['contract'] as Map<String, dynamic>?)?['customer'] as Map<String, dynamic>?)?['fullName'] as String?,
      basisAmount: json['basisAmount']?.toString(),
      commissionPct: json['commissionPct']?.toString(),
      earnedAt: json['earnedAt'] as String?,
      payoutId: json['payoutId'] as String?,
    );
  }
}
