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

  factory VisitDto.fromJson(Map<String, dynamic> json) {
    final client = json['client'] as Map<String, dynamic>?;
    final lead = json['lead'] as Map<String, dynamic>?;
    final project = json['project'] as Map<String, dynamic>?;
    final projectName = project?['name'];
    final unit = json['unit'] as Map<String, dynamic>?;
    return VisitDto(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'SCHEDULED',
      visitNumber: json['visitNumber'] as String?,
      scheduledAt: json['scheduledAt'] as String?,
      // Prefer the linked client/lead name, then the standalone customerName.
      clientName: (client?['fullName'] as String?) ??
          (lead?['fullName'] as String?) ??
          json['customerName'] as String?,
      clientPhone: (client?['phone'] as String?) ??
          (lead?['phone'] as String?) ??
          json['customerPhone'] as String?,
      projectName: projectName is Map ? projectName['en'] as String? : projectName as String?,
      unitCode: unit?['code'] as String?,
      location: json['location'] as String?,
      leadId: lead?['id'] as String?,
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
