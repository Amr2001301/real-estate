import 'package:core/core.dart';
import 'package:flutter/foundation.dart' show debugPrint;

import '../domain/services/push_token_provider.dart';
import '../domain/usecases/notification_use_cases.dart';

/// Registers the device for push **after login, only if permission is granted
/// and a token is available**. With the no-op provider this is a safe no-op
/// (nothing faked). Wire a real provider to enable it.
class PushRegistrationService {
  PushRegistrationService(this._provider, this._registerDevice);

  final PushTokenProvider _provider;
  final RegisterDevice _registerDevice;

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
}
