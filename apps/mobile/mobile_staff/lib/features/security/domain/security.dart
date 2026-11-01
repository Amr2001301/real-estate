import 'package:core/core.dart';

/// SES1 / TFA1 in the staff app — «الأمان»: the devices signed in to the
/// account, two-step sign-in, and the password. Own account only.

/// One signed-in device.
class DeviceSession extends Equatable {
  const DeviceSession({required this.id, this.userAgent, this.ip, this.createdAt, this.lastSeenAt, this.current = false});

  factory DeviceSession.fromJson(Map<String, dynamic> json) {
    DateTime? at(Object? v) => v is String ? DateTime.tryParse(v)?.toLocal() : null;
    return DeviceSession(
      id: json['id'] as String,
      userAgent: json['userAgent'] as String?,
      ip: json['ipAddress'] as String?,
      createdAt: at(json['createdAt']),
      lastSeenAt: at(json['lastSeenAt']),
      current: json['current'] == true,
    );
  }

  final String id;
  final String? userAgent;
  final String? ip;
  final DateTime? createdAt;
  final DateTime? lastSeenAt;

  /// This phone.
  final bool current;

  /// What the device is, read from its user agent.
  DeviceKind get kind => deviceKindOf(userAgent);

  @override
  List<Object?> get props => [id, userAgent, ip, createdAt, lastSeenAt, current];
}

enum DeviceKind { iphone, android, windows, mac, linux, web, unknown }

/// The app sends "Dart/x (dart:io)" with the platform; browsers their usual agent.
DeviceKind deviceKindOf(String? ua) {
  final s = (ua ?? '').toLowerCase();
  if (s.isEmpty) return DeviceKind.unknown;
  if (s.contains('iphone') || s.contains('ipad') || s.contains('ios')) return DeviceKind.iphone;
  if (s.contains('android')) return DeviceKind.android;
  if (s.contains('windows')) return DeviceKind.windows;
  if (s.contains('mac os') || s.contains('macintosh')) return DeviceKind.mac;
  if (s.contains('linux')) return DeviceKind.linux;
  if (s.contains('mozilla') || s.contains('chrome') || s.contains('safari')) return DeviceKind.web;
  return DeviceKind.unknown;
}

/// The browser in a web user agent, for a readable line ("Chrome", "Safari").
String? browserOf(String? ua) {
  final s = ua ?? '';
  if (s.contains('Edg/')) return 'Edge';
  if (s.contains('Chrome/')) return 'Chrome';
  if (s.contains('Firefox/')) return 'Firefox';
  if (s.contains('Safari/')) return 'Safari';
  if (s.startsWith('Dart/')) return null;
  return null;
}

class TwoFactorStatus extends Equatable {
  const TwoFactorStatus({this.available = false, this.enabled = false, this.required = false, this.recoveryCodesLeft = 0, this.enabledAt});

  factory TwoFactorStatus.fromJson(Map<String, dynamic> json) => TwoFactorStatus(
        available: json['available'] == true,
        enabled: json['enabled'] == true,
        required: json['required'] == true,
        recoveryCodesLeft: (json['recoveryCodesLeft'] as num?)?.toInt() ?? 0,
        enabledAt: json['enabledAt'] is String ? DateTime.tryParse(json['enabledAt'] as String)?.toLocal() : null,
      );

  /// Staff accounts can use it.
  final bool available;
  final bool enabled;

  /// The company requires it: it cannot be turned off.
  final bool required;
  final int recoveryCodesLeft;
  final DateTime? enabledAt;

  @override
  List<Object?> get props => [available, enabled, required, recoveryCodesLeft, enabledAt];
}

/// A new secret to add to the authenticator app.
class TwoFactorSetup extends Equatable {
  const TwoFactorSetup({required this.secret, required this.otpauthUrl});
  final String secret;
  final String otpauthUrl;

  @override
  List<Object?> get props => [secret, otpauthUrl];
}

abstract interface class SecurityRepository {
  Future<Result<List<DeviceSession>>> sessions();
  Future<Result<void>> signOut(String sessionId);

  /// How many other devices were signed out.
  Future<Result<int>> signOutOthers();

  Future<Result<TwoFactorStatus>> twoFactor();
  Future<Result<TwoFactorSetup>> setupTwoFactor();

  /// On, with the recovery codes (shown once).
  Future<Result<List<String>>> enableTwoFactor(String code);
  Future<Result<void>> disableTwoFactor({required String password, required String code});
  Future<Result<List<String>>> newRecoveryCodes(String code);

  Future<Result<void>> changePassword({required String current, required String next});
}
