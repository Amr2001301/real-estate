/// Carries a single pending mismatch message from the [TenantSlugInterceptor]
/// to the [StaffLoginScreen]. The message is consumed (cleared) on first read
/// so it shows exactly once after a session-clearing mismatch redirect.
///
/// The notifier is provided above the router so it survives navigation.
/// It is NOT an auth authority — it is purely a UX messaging aid. A plain
/// holder, not a ChangeNotifier: nothing listens (the login screen reads it
/// when it builds), and a Provider refuses a Listenable in debug builds.
class TenantMismatchNotifier {
  String? _pendingMessage;

  bool get hasPendingMessage => _pendingMessage != null;

  /// Sets the message the login screen shows on its next build.
  void setMessage(String message) {
    _pendingMessage = message;
  }

  /// Returns and clears the pending message. Returns null if none is set.
  String? consumeMessage() {
    final msg = _pendingMessage;
    _pendingMessage = null;
    return msg;
  }
}
