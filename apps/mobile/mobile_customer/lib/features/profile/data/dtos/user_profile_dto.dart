// Wire shape of GET/PATCH /users/me. Data layer only.
class UserProfileDto {
  const UserProfileDto({
    required this.id,
    required this.role,
    this.fullName,
    this.email,
    this.phone,
    this.locale,
  });

  final String id;
  final String role;
  final String? fullName;
  final String? email;
  final String? phone;
  final String? locale;

  factory UserProfileDto.fromJson(Map<String, dynamic> json) => UserProfileDto(
        id: json['id'] as String,
        role: json['role'] as String? ?? 'CLIENT',
        fullName: json['fullName'] as String?,
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        locale: json['locale'] as String?,
      );
}
