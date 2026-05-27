// Wire shape of /me/visit-requests items. Data layer only.
class VisitRequestDto {
  const VisitRequestDto({
    required this.id,
    required this.projectId,
    required this.statusWire,
    this.unitId,
    this.projectNameAr,
    this.projectNameEn,
    this.preferredDate,
    this.notes,
    this.createdAt,
  });

  final String id;
  final String projectId;
  final String? unitId;
  final String statusWire;
  final String? projectNameAr;
  final String? projectNameEn;
  final String? preferredDate;
  final String? notes;
  final String? createdAt;

  factory VisitRequestDto.fromJson(Map<String, dynamic> json) {
    final project = json['project'] as Map<String, dynamic>?;
    final nameMap = project?['name'] as Map<String, dynamic>?;
    return VisitRequestDto(
      id: json['id'] as String,
      projectId: json['projectId'] as String? ?? '',
      unitId: json['unitId'] as String?,
      statusWire: json['status'] as String? ?? 'PENDING',
      projectNameAr: nameMap?['ar'] as String?,
      projectNameEn: nameMap?['en'] as String?,
      preferredDate: json['preferredDate'] as String?,
      notes: json['notes'] as String?,
      createdAt: json['createdAt'] as String?,
    );
  }
}
