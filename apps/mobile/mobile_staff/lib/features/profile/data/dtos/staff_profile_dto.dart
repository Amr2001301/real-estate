// Subset of GET /users/me needed for the staff profile. Data layer only.
class StaffProfileDto {
  const StaffProfileDto({
    required this.id,
    required this.role,
    this.fullName,
    this.email,
    this.phone,
  });

  final String id;
  final String role;
  final String? fullName;
  final String? email;
  final String? phone;

  factory StaffProfileDto.fromJson(Map<String, dynamic> json) => StaffProfileDto(
        id: json['id'] as String,
        role: json['role'] as String? ?? 'SALES',
        fullName: json['fullName'] as String?,
        email: json['email'] as String?,
        phone: json['phone'] as String?,
      );
}
