import 'package:core/core_domain.dart';

/// The authenticated user's profile. Domain entity (pure Dart).
class UserProfile extends Equatable {
  const UserProfile({
    required this.id,
    required this.role,
    this.fullName,
    this.email,
    this.phone,
    this.locale,
  });

  final String id;
  final AppRole role;
  final String? fullName;
  final String? email;
  final String? phone;

  /// 'ar' | 'en'.
  final String? locale;

  @override
  List<Object?> get props => [id, role, fullName, email, phone, locale];
}
