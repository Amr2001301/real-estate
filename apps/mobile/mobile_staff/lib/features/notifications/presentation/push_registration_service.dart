import 'package:core/core.dart';

import '../domain/services/push_token_provider.dart';
import '../domain/usecases/notification_use_cases.dart';

/// Registers the device for push after login, only when permission is granted
/// and a token is available. With [NoopPushTokenProvider] this is a safe no-op.
class PushRegistrationService {
  PushRegistrationService(this._provider, this._registerDevice);

  final PushTokenProvider _provider;
  final RegisterDevice _registerDevice;

  Future<void> registerIfPossible() async {
    final granted = await _provider.requestPermission();
    if (!granted) return;
    final token = await _provider.getToken();
    if (token == null || token.isEmpty) return;
    final result = await _registerDevice(
      RegisterDeviceParams(token: token, platform: _provider.platform),
    );
    final failure = result.failureOrNull;
    if (failure != null) AppLog.failure(failure);
  }
}
