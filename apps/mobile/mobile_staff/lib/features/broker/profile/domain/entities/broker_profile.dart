import 'package:core/core_domain.dart';

/// The signed-in broker user's profile (from /portal/me).
class BrokerProfile extends Equatable {
  const BrokerProfile({
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

  @override
  List<Object?> get props =>
      [canViewCommissions, isPrimaryContact, fullName, email, companyName, brokerCode];
}
