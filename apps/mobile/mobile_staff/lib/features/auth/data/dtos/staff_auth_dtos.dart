// Wire shapes for the staff auth endpoints. Data layer only.

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
        role: json['role'] as String? ?? 'SALES',
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

/// `{ user, tokens }` returned by `/auth/login` and `/auth/refresh`.
class AuthBundleDto {
  const AuthBundleDto({required this.user, required this.tokens});
  final AuthUserDto user;
  final AuthTokensDto tokens;

  factory AuthBundleDto.fromJson(Map<String, dynamic> json) => AuthBundleDto(
        user: AuthUserDto.fromJson(json['user'] as Map<String, dynamic>),
        tokens: AuthTokensDto.fromJson(json['tokens'] as Map<String, dynamic>),
      );
}

/// TFA1 — `/auth/login-staff` answers with a session, or with the second step:
/// `{ twoFactorRequired | twoFactorSetupRequired, challenge }`.
class StaffLoginResponseDto {
  const StaffLoginResponseDto({this.bundle, this.challenge, this.setupRequired = false});
  final AuthBundleDto? bundle;
  final String? challenge;
  final bool setupRequired;

  factory StaffLoginResponseDto.fromJson(Map<String, dynamic> json) {
    final challenge = json['challenge'];
    if (challenge is String && challenge.isNotEmpty) {
      return StaffLoginResponseDto(
        challenge: challenge,
        setupRequired: json['twoFactorSetupRequired'] == true,
      );
    }
    return StaffLoginResponseDto(bundle: AuthBundleDto.fromJson(json));
  }
}

/// `{ secret, otpauthUrl }` from `/auth/2fa/setup-challenge`.
class TwoFactorSetupDto {
  const TwoFactorSetupDto({required this.secret, required this.otpauthUrl});
  final String secret;
  final String otpauthUrl;

  factory TwoFactorSetupDto.fromJson(Map<String, dynamic> json) => TwoFactorSetupDto(
        secret: json['secret'] as String? ?? '',
        otpauthUrl: json['otpauthUrl'] as String? ?? '',
      );
}

/// `{ user, tokens, recoveryCodes }` from `/auth/2fa/enable-challenge`.
class TwoFactorEnabledDto {
  const TwoFactorEnabledDto({required this.bundle, required this.recoveryCodes});
  final AuthBundleDto bundle;
  final List<String> recoveryCodes;

  factory TwoFactorEnabledDto.fromJson(Map<String, dynamic> json) => TwoFactorEnabledDto(
        bundle: AuthBundleDto.fromJson(json),
        recoveryCodes: [for (final c in (json['recoveryCodes'] as List<dynamic>? ?? const [])) c as String],
      );
}
