// Wire shape for GET /portal/me. Data layer only.
class BrokerProfileDto {
  const BrokerProfileDto({
    required this.canViewCommissions,
    required this.isPrimaryContact,
    required this.canManageBrokerUsers,
    this.fullName,
    this.email,
    this.phone,
    this.jobTitle,
    this.companyName,
    this.brokerCode,
  });

  final bool canViewCommissions;
  final bool isPrimaryContact;
  final bool canManageBrokerUsers;
  final String? fullName;
  final String? email;
  final String? phone;
  final String? jobTitle;
  final String? companyName;
  final String? brokerCode;

  factory BrokerProfileDto.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>?;
    final brokerUser = json['brokerUser'] as Map<String, dynamic>?;
    final broker = json['broker'] as Map<String, dynamic>?;
    final perms = json['permissions'] as Map<String, dynamic>?;
    return BrokerProfileDto(
      canViewCommissions: perms?['canViewCommissions'] as bool? ?? false,
      isPrimaryContact: perms?['isPrimaryContact'] as bool? ?? false,
      canManageBrokerUsers: perms?['canManageBrokerUsers'] as bool? ?? false,
      fullName: user?['fullName'] as String?,
      email: user?['email'] as String?,
      phone: user?['phone'] as String?,
      jobTitle: brokerUser?['jobTitle'] as String?,
      companyName: (broker?['commercialName'] as String?) ?? broker?['companyName'] as String?,
      brokerCode: broker?['code'] as String?,
    );
  }
}
