// Wire shapes for /portal/leads. Data layer only.

class BrokerLeadDto {
  const BrokerLeadDto({
    required this.id,
    required this.fullName,
    required this.stage,
    required this.approvalStatus,
    this.phone,
    this.email,
    this.projectName,
    this.createdAt,
  });

  final String id;
  final String fullName;
  final String stage;
  final String approvalStatus;
  final String? phone;
  final String? email;
  final String? projectName;
  final String? createdAt;

  factory BrokerLeadDto.fromJson(Map<String, dynamic> json) {
    final client = json['client'] as Map<String, dynamic>?;
    final project = json['projectInterest'] as Map<String, dynamic>?;
    final name = project?['name'];
    return BrokerLeadDto(
      id: json['id'] as String,
      fullName: (client?['fullName'] as String?) ?? json['fullName'] as String? ?? '',
      phone: (client?['phone'] as String?) ?? json['phone'] as String?,
      email: (client?['email'] as String?) ?? json['email'] as String?,
      stage: json['stage'] as String? ?? 'NEW',
      approvalStatus: json['brokerApprovalStatus'] as String? ?? 'PENDING',
      projectName: name is Map ? name['en'] as String? : name as String?,
      createdAt: json['createdAt'] as String?,
    );
  }
}

class BrokerLeadNoteDto {
  const BrokerLeadNoteDto({required this.id, required this.body, this.authorName, this.createdAt});
  final String id;
  final String body;
  final String? authorName;
  final String? createdAt;

  factory BrokerLeadNoteDto.fromJson(Map<String, dynamic> json) => BrokerLeadNoteDto(
        id: json['id'] as String,
        body: json['body'] as String? ?? '',
        authorName: (json['sales'] as Map<String, dynamic>?)?['fullName'] as String?,
        createdAt: json['createdAt'] as String?,
      );
}

class BrokerLeadActivityDto {
  const BrokerLeadActivityDto({required this.id, required this.type, this.createdAt});
  final String id;
  final String type;
  final String? createdAt;

  factory BrokerLeadActivityDto.fromJson(Map<String, dynamic> json) => BrokerLeadActivityDto(
        id: json['id'] as String,
        type: json['type'] as String? ?? 'activity',
        createdAt: json['createdAt'] as String?,
      );
}

class BrokerLeadDetailDto {
  const BrokerLeadDetailDto({
    required this.lead,
    required this.notes,
    required this.activities,
    this.unitCode,
  });

  final BrokerLeadDto lead;
  final List<BrokerLeadNoteDto> notes;
  final List<BrokerLeadActivityDto> activities;
  final String? unitCode;

  factory BrokerLeadDetailDto.fromJson(Map<String, dynamic> json) {
    final unit = json['unitInterest'] as Map<String, dynamic>?;
    return BrokerLeadDetailDto(
      lead: BrokerLeadDto.fromJson(json),
      unitCode: unit?['code'] as String?,
      notes: ((json['notes'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(BrokerLeadNoteDto.fromJson)
          .toList(),
      activities: ((json['activities'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(BrokerLeadActivityDto.fromJson)
          .toList(),
    );
  }
}
