import 'package:core/core_domain.dart';

/// The authenticated staff member's profile. Domain entity.
class StaffProfile extends Equatable {
  const StaffProfile({
    required this.id,
    required this.role,
    this.fullName,
    this.email,
    this.phone,
  });

  final String id;
  final AppRole role;
  final String? fullName;
  final String? email;
  final String? phone;

  @override
  List<Object?> get props => [id, role, fullName, email, phone];
}
