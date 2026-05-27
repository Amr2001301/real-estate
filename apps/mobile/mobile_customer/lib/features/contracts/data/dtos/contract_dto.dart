// Subset of a /me/contracts row needed to present a contract. Data layer only.
// Any legacy public contract PDF URLs on the row are intentionally ignored —
// documents are fetched via the signed documents endpoint.
class ContractDto {
  const ContractDto({
    required this.id,
    required this.unitCode,
    required this.unitType,
    required this.signed,
    this.contractNumber,
    this.projectNameAr,
    this.projectNameEn,
    this.signedAt,
    this.createdAt,
  });

  final String id;
  final String unitCode;
  final String unitType;
  final bool signed;
  final String? contractNumber;
  final String? projectNameAr;
  final String? projectNameEn;
  final String? signedAt;
  final String? createdAt;

  factory ContractDto.fromJson(Map<String, dynamic> json) {
    final unit = json['unit'] as Map<String, dynamic>?;
    final project = ((unit?['building'] as Map<String, dynamic>?)?['phase']
            as Map<String, dynamic>?)?['project'] as Map<String, dynamic>?;
    final projectName = project?['name'] as Map<String, dynamic>?;
    return ContractDto(
      id: json['id'] as String,
      contractNumber: json['contractNumber'] as String?,
      unitCode: unit?['code'] as String? ?? '',
      unitType: unit?['type'] as String? ?? '',
      projectNameAr: projectName?['ar'] as String?,
      projectNameEn: projectName?['en'] as String?,
      signed: json['signedAt'] != null,
      signedAt: json['signedAt'] as String?,
      createdAt: json['createdAt'] as String?,
    );
  }
}
