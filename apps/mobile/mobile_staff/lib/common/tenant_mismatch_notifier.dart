import 'package:flutter/foundation.dart';

/// Carries a single pending mismatch message from the [TenantSlugInterceptor]
/// to the [StaffLoginScreen]. The message is consumed (cleared) on first read
/// so it shows exactly once after a session-clearing mismatch redirect.
///
/// The notifier is provided above the router so it survives navigation.
/// It is NOT an auth authority — it is purely a UX messaging aid.
class TenantMismatchNotifier extends ChangeNotifier {
  String? _pendingMessage;

  bool get hasPendingMessage => _pendingMessage != null;

  /// Sets the message and notifies listeners (e.g. to trigger a router refresh
  /// that rebuilds the login screen).
  void setMessage(String message) {
    _pendingMessage = message;
    notifyListeners();
  }

  /// Returns and clears the pending message. Returns null if none is set.
  String? consumeMessage() {
    final msg = _pendingMessage;
    _pendingMessage = null;
    return msg;
  }
}
