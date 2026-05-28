// A /leads row projected to the fields the Clients view needs. Data layer only.
class ClientLeadDto {
  const ClientLeadDto({
    required this.leadId,
    required this.clientId,
    required this.fullName,
    required this.stage,
    this.phone,
    this.email,
    this.projectInterest,
    this.createdAt,
  });

  final String leadId;
  final String clientId;
  final String fullName;
  final String stage;
  final String? phone;
  final String? email;
  final String? projectInterest;
  final String? createdAt;

  factory ClientLeadDto.fromJson(Map<String, dynamic> json) {
    final client = json['client'] as Map<String, dynamic>?;
    final project = json['projectInterest'] as Map<String, dynamic>?;
    final projectName = project?['name'];
    // Fall back to the lead id when no linked client id exists, so the lead
    // still appears as a (single-lead) client rather than being dropped.
    final clientId = (client?['id'] as String?) ?? json['id'] as String;
    return ClientLeadDto(
      leadId: json['id'] as String,
      clientId: clientId,
      fullName: (client?['fullName'] as String?) ?? json['fullName'] as String? ?? '',
      phone: (client?['phone'] as String?) ?? json['phone'] as String?,
      email: (client?['email'] as String?) ?? json['email'] as String?,
      stage: json['stage'] as String? ?? 'NEW',
      projectInterest: projectName is Map ? projectName['en'] as String? : projectName as String?,
      createdAt: json['createdAt'] as String?,
    );
  }
}
