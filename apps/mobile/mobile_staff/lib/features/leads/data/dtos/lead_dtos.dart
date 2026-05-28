// Wire shapes for the leads endpoints. Data layer only.

class LeadRowDto {
  const LeadRowDto({
    required this.id,
    required this.fullName,
    required this.stage,
    this.phone,
    this.email,
    this.projectInterest,
    this.assignedSalesName,
    this.createdAt,
  });

  final String id;
  final String fullName;
  final String stage;
  final String? phone;
  final String? email;
  final String? projectInterest;
  final String? assignedSalesName;
  final String? createdAt;

  factory LeadRowDto.fromJson(Map<String, dynamic> json) {
    final client = json['client'] as Map<String, dynamic>?;
    final assigned = json['assignedSales'] as Map<String, dynamic>?;
    final project = json['projectInterest'] as Map<String, dynamic>?;
    final projectName = project?['name'];
    return LeadRowDto(
      id: json['id'] as String,
      // Prefer the linked client's canonical contact; fall back to the row cache.
      fullName: (client?['fullName'] as String?) ?? json['fullName'] as String? ?? '',
      phone: (client?['phone'] as String?) ?? json['phone'] as String?,
      email: (client?['email'] as String?) ?? json['email'] as String?,
      stage: json['stage'] as String? ?? 'NEW',
      projectInterest: projectName is Map ? projectName['en'] as String? : projectName as String?,
      assignedSalesName: assigned?['fullName'] as String?,
      createdAt: json['createdAt'] as String?,
    );
  }
}

class LeadNoteDto {
  const LeadNoteDto({required this.id, required this.body, this.authorName, this.createdAt});
  final String id;
  final String body;
  final String? authorName;
  final String? createdAt;

  factory LeadNoteDto.fromJson(Map<String, dynamic> json) => LeadNoteDto(
        id: json['id'] as String,
        body: json['body'] as String? ?? '',
        authorName: (json['sales'] as Map<String, dynamic>?)?['fullName'] as String?,
        createdAt: json['createdAt'] as String?,
      );
}

class LeadActivityDto {
  const LeadActivityDto({required this.id, required this.type, this.createdAt});
  final String id;
  final String type;
  final String? createdAt;

  factory LeadActivityDto.fromJson(Map<String, dynamic> json) => LeadActivityDto(
        id: json['id'] as String,
        type: json['type'] as String? ?? 'activity',
        createdAt: json['createdAt'] as String?,
      );
}

class LeadDetailDto {
  const LeadDetailDto({
    required this.lead,
    required this.notes,
    required this.activities,
    this.unitInterest,
  });

  final LeadRowDto lead;
  final List<LeadNoteDto> notes;
  final List<LeadActivityDto> activities;
  final String? unitInterest;

  factory LeadDetailDto.fromJson(Map<String, dynamic> json) {
    final unit = json['unitInterest'] as Map<String, dynamic>?;
    return LeadDetailDto(
      lead: LeadRowDto.fromJson(json),
      unitInterest: unit?['code'] as String?,
      notes: ((json['notes'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(LeadNoteDto.fromJson)
          .toList(),
      activities: ((json['activities'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(LeadActivityDto.fromJson)
          .toList(),
    );
  }
}
