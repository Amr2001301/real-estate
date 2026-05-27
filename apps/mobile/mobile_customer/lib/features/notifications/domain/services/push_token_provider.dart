/// Abstraction over the platform push SDK. Kept as a pure-Dart contract so the
/// app can wire device registration without depending on a concrete push SDK.
///
/// The current implementation is a no-op (returns no permission / no token), so
/// nothing is faked. Plugging in real FCM later = one implementation that uses
/// `firebase_messaging` + `permission_handler`, plus native Firebase config.
abstract interface class PushTokenProvider {
  /// Requests OS notification permission. Returns true only if granted.
  Future<bool> requestPermission();

  /// The current device push token, or null when unavailable/denied.
  Future<String?> getToken();

  /// 'ios' | 'android' | 'web'.
  String get platform;
}
