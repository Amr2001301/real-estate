// Wire shape of /me/visit-requests items. Data layer only.

/// Summary of the most recent appointment attached to a visit request, as
/// returned by the API since the P2 backend roll-out. The customer card
/// renders confirm / request-reschedule buttons against this shape when the
/// status is SCHEDULED.
class AppointmentSummaryDto {
  const AppointmentSummaryDto({
    required this.id,
    required this.statusWire,
    this.scheduledAt,
    this.durationMinutes,
    this.location,
    this.meetingPoint,
    this.customerFeedback,
  });

  final String id;
  final String statusWire;
  final String? scheduledAt;
  final int? durationMinutes;
  final String? location;
  final String? meetingPoint;
  final String? customerFeedback;

  factory AppointmentSummaryDto.fromJson(Map<String, dynamic> json) =>
      AppointmentSummaryDto(
        id: json['id'] as String,
        statusWire: json['status'] as String? ?? 'SCHEDULED',
        scheduledAt: json['scheduledAt'] as String?,
        durationMinutes: (json['durationMinutes'] as num?)?.toInt(),
        location: json['location'] as String?,
        meetingPoint: json['meetingPoint'] as String?,
        customerFeedback: json['customerFeedback'] as String?,
      );
}

class VisitRequestDto {
  const VisitRequestDto({
    required this.id,
    required this.projectId,
    required this.statusWire,
    this.unitId,
    this.projectNameAr,
    this.projectNameEn,
    this.preferredDate,
    this.preferredTime,
    this.notes,
    this.requestNotes,
    this.scheduledAt,
    this.createdAt,
    this.assignedSalesId,
    this.assignedSalesName,
    this.appointments = const [],
  });

  final String id;
  final String projectId;
  final String? unitId;
  final String statusWire;
  final String? projectNameAr;
  final String? projectNameEn;
  final String? preferredDate;
  final String? preferredTime;
  final String? notes;
  final String? requestNotes;
  final String? scheduledAt;
  final String? createdAt;
  final String? assignedSalesId;
  final String? assignedSalesName;
  final List<AppointmentSummaryDto> appointments;

  factory VisitRequestDto.fromJson(Map<String, dynamic> json) {
    final project = json['project'] as Map<String, dynamic>?;
    final nameMap = project?['name'] as Map<String, dynamic>?;
    final sales = json['assignedSales'] as Map<String, dynamic>?;
    final apps = (json['appointments'] as List?) ?? const [];
    return VisitRequestDto(
      id: json['id'] as String,
      projectId: json['projectId'] as String? ?? '',
      unitId: json['unitId'] as String?,
      statusWire: json['status'] as String? ?? 'PENDING',
      projectNameAr: nameMap?['ar'] as String?,
      projectNameEn: nameMap?['en'] as String?,
      preferredDate: json['preferredDate'] as String?,
      preferredTime: json['preferredTime'] as String?,
      notes: json['notes'] as String?,
      requestNotes: json['requestNotes'] as String?,
      scheduledAt: json['scheduledAt'] as String?,
      createdAt: json['createdAt'] as String?,
      assignedSalesId: sales?['id'] as String?,
      assignedSalesName: sales?['fullName'] as String?,
      appointments: apps
          .whereType<Map<String, dynamic>>()
          .map(AppointmentSummaryDto.fromJson)
          .toList(growable: false),
    );
  }
}
