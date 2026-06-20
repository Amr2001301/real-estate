/// Abstraction over the platform push SDK. Kept as a pure-Dart contract so the
/// app can wire device registration without depending on a concrete push SDK.
abstract interface class PushTokenProvider {
  /// Requests OS notification permission. Returns true only if granted.
  Future<bool> requestPermission();

  /// The current device push token, or null when unavailable/denied.
  Future<String?> getToken();

  /// 'ios' | 'android' | 'web'.
  String get platform;
}
