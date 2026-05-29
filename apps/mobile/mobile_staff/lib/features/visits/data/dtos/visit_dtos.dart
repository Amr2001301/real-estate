// Wire shapes for the visit appointment endpoints. Data layer only.

class VisitDto {
  const VisitDto({
    required this.id,
    required this.status,
    this.visitNumber,
    this.scheduledAt,
    this.clientName,
    this.clientPhone,
    this.projectName,
    this.unitCode,
    this.location,
    this.leadId,
    this.customerFeedback,
    this.requestPreferredDate,
    this.requestPreferredTime,
    this.requestNotes,
  });

  final String id;
  final String status;
  final String? visitNumber;
  final String? scheduledAt;
  final String? clientName;
  final String? clientPhone;
  final String? projectName;
  final String? unitCode;
  final String? location;
  final String? leadId;

  /// Customer's reschedule reason, mirrored from the appointment row
  /// (`customerFeedback` column) when the customer used the P2 two-sided
  /// confirmation flow.
  final String? customerFeedback;

  /// What the customer originally asked for at submission time. Pulled from
  /// the parent `visitRequest` include — admin tooling renders these too.
  final String? requestPreferredDate;
  final String? requestPreferredTime;
  final String? requestNotes;

  factory VisitDto.fromJson(Map<String, dynamic> json) {
    final client = json['client'] as Map<String, dynamic>?;
    final lead = json['lead'] as Map<String, dynamic>?;
    final project = json['project'] as Map<String, dynamic>?;
    final projectName = project?['name'];
    final unit = json['unit'] as Map<String, dynamic>?;
    final visitRequest = json['visitRequest'] as Map<String, dynamic>?;
    return VisitDto(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'SCHEDULED',
      visitNumber: json['visitNumber'] as String?,
      scheduledAt: json['scheduledAt'] as String?,
      // Prefer the linked client/lead name, then the standalone customerName.
      clientName: (client?['fullName'] as String?) ??
          (lead?['fullName'] as String?) ??
          json['customerName'] as String? ??
          visitRequest?['customerName'] as String?,
      clientPhone: (client?['phone'] as String?) ??
          (lead?['phone'] as String?) ??
          json['customerPhone'] as String? ??
          visitRequest?['customerPhone'] as String?,
      projectName: projectName is Map ? projectName['en'] as String? : projectName as String?,
      unitCode: unit?['code'] as String?,
      location: json['location'] as String?,
      leadId: lead?['id'] as String?,
      customerFeedback: json['customerFeedback'] as String?,
      requestPreferredDate: visitRequest?['preferredDate'] as String?,
      requestPreferredTime: visitRequest?['preferredTime'] as String?,
      // P2 backend writes both `notes` and `requestNotes`; fall back to the
      // legacy column for pre-P2 rows so sales sees the customer message on
      // historical visits too.
      requestNotes: visitRequest?['requestNotes'] as String? ??
          visitRequest?['notes'] as String?,
    );
  }
}

class VisitActivityDto {
  const VisitActivityDto({required this.id, required this.type, this.note, this.actorName, this.createdAt});
  final String id;
  final String type;
  final String? note;
  final String? actorName;
  final String? createdAt;

  factory VisitActivityDto.fromJson(Map<String, dynamic> json) => VisitActivityDto(
        id: json['id'] as String,
        type: json['type'] as String? ?? 'activity',
        note: json['note'] as String?,
        actorName: (json['actor'] as Map<String, dynamic>?)?['fullName'] as String?,
        createdAt: json['createdAt'] as String?,
      );
}

class VisitDetailDto {
  const VisitDetailDto({required this.visit, required this.activities, this.salesNotes});
  final VisitDto visit;
  final List<VisitActivityDto> activities;
  final String? salesNotes;

  factory VisitDetailDto.fromJson(Map<String, dynamic> json) => VisitDetailDto(
        visit: VisitDto.fromJson(json),
        salesNotes: json['salesNotes'] as String?,
        activities: ((json['visitActivities'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(VisitActivityDto.fromJson)
            .toList(),
      );
}
