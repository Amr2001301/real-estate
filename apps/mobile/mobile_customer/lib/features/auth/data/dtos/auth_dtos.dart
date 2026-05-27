// Wire shapes for the auth endpoints. Data layer only.

class AuthUserDto {
  const AuthUserDto({
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

  factory AuthUserDto.fromJson(Map<String, dynamic> json) => AuthUserDto(
        id: json['id'] as String,
        role: json['role'] as String? ?? 'CLIENT',
        fullName: json['fullName'] as String?,
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        locale: json['locale'] as String?,
      );
}

class AuthTokensDto {
  const AuthTokensDto({required this.accessToken, required this.refreshToken});
  final String accessToken;
  final String refreshToken;

  factory AuthTokensDto.fromJson(Map<String, dynamic> json) => AuthTokensDto(
        accessToken: json['accessToken'] as String? ?? '',
        refreshToken: json['refreshToken'] as String? ?? '',
      );
}

/// `{ user, tokens }` returned by login/register/verifyOtp/refresh.
class AuthBundleDto {
  const AuthBundleDto({required this.user, required this.tokens});
  final AuthUserDto user;
  final AuthTokensDto tokens;

  factory AuthBundleDto.fromJson(Map<String, dynamic> json) => AuthBundleDto(
        user: AuthUserDto.fromJson(json['user'] as Map<String, dynamic>),
        tokens: AuthTokensDto.fromJson(json['tokens'] as Map<String, dynamic>),
      );
}
