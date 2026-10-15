import 'package:core/core.dart';
import 'package:flutter/foundation.dart' show debugPrint;

import '../domain/services/push_token_provider.dart';
import '../domain/usecases/notification_use_cases.dart';

/// Registers the device for push after login, only when permission is granted
/// and a token is available. With [NoopPushTokenProvider] this is a safe no-op.
class PushRegistrationService {
  PushRegistrationService(this._provider, this._registerDevice, [this._unregisterDevice]);

  final PushTokenProvider _provider;
  final RegisterDevice _registerDevice;
  final UnregisterDevice? _unregisterDevice;

  Future<void> registerIfPossible() async {
    debugPrint('[PushReg] requesting permission…');
    final granted = await _provider.requestPermission();
    debugPrint('[PushReg] permission granted=$granted');
    if (!granted) return;

    final token = await _provider.getToken();
    if (token == null || token.isEmpty) {
      debugPrint(
        '[PushReg] getToken() returned null — '
        'no device token (iOS Simulator has no APNs; use a real device)',
      );
      return;
    }
    debugPrint('[PushReg] token present=true length=${token.length} platform=${_provider.platform}');

    final result = await _registerDevice(
      RegisterDeviceParams(token: token, platform: _provider.platform),
    );
    final failure = result.failureOrNull;
    if (failure == null) {
      debugPrint('[PushReg] registered with backend platform=${_provider.platform}');
    } else {
      debugPrint('[PushReg] backend registration failed: ${failure.technicalMessage}');
      AppLog.failure(failure);
    }
  }

  /// Before logout: the backend stops pushing this user's notifications to
  /// this device, so the next person to use it never sees them. Best-effort
  /// and bounded — logout never waits on it for long or fails because of it.
  Future<void> unregisterIfPossible() async {
    final unregister = _unregisterDevice;
    if (unregister == null) return;
    try {
      final token = await _provider.getToken().timeout(const Duration(seconds: 3));
      if (token == null || token.isEmpty) return;
      final result = await unregister(token).timeout(const Duration(seconds: 5));
      final failure = result.failureOrNull;
      if (failure != null) {
        debugPrint('[PushReg] unregister failed: ${failure.technicalMessage}');
      }
    } catch (e) {
      debugPrint('[PushReg] unregister skipped: $e');
    }
  }
}
