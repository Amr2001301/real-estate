import 'package:core/core_domain.dart';

// Subset of a /me/contracts row needed to present a property. Data layer only.
// Note: any legacy public document URLs on the row are intentionally ignored.
class PropertyRowDto {
  const PropertyRowDto({
    required this.contractId,
    required this.unitId,
    required this.unitCode,
    required this.unitType,
    required this.signed,
    this.contractNumber,
    this.projectId,
    this.projectNameAr,
    this.projectNameEn,
    this.signedAt,
    this.reservationNumber,
    this.monthlyAmount,
    this.totalMonths,
  });

  final String contractId;
  final String unitId;
  final String unitCode;
  final String unitType;
  final bool signed;
  final String? contractNumber;
  final String? projectId;
  final String? projectNameAr;
  final String? projectNameEn;
  final String? signedAt;
  final String? reservationNumber;
  final String? monthlyAmount;
  final int? totalMonths;

  factory PropertyRowDto.fromJson(Map<String, dynamic> json) {
    final unit = json['unit'] as Map<String, dynamic>?;
    final project =
        ((unit?['building'] as Map<String, dynamic>?)?['phase']
                as Map<String, dynamic>?)?['project']
            as Map<String, dynamic>?;
    // Tolerant: the locale interceptor may flatten `name` to a localized
    // string, so never cast it directly to a Map.
    final projectName = Translatable.fromJson(project?['name']);
    final reservation = json['reservation'] as Map<String, dynamic>?;
    final plan = json['installmentPlan'] as Map<String, dynamic>?;
    return PropertyRowDto(
      contractId: json['id'] as String,
      contractNumber: json['contractNumber'] as String?,
      unitId: unit?['id'] as String? ?? '',
      unitCode: unit?['code'] as String? ?? '',
      unitType: unit?['type'] as String? ?? '',
      projectId: project?['id'] as String?,
      projectNameAr: projectName.ar,
      projectNameEn: projectName.en,
      signed: json['signedAt'] != null,
      signedAt: json['signedAt'] as String?,
      reservationNumber: reservation?['reservationNumber'] as String?,
      monthlyAmount: plan?['monthlyAmount']?.toString(),
      totalMonths: (plan?['totalMonths'] as num?)?.toInt(),
    );
  }
}
