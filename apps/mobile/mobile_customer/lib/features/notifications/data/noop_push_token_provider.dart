import 'dart:io' show Platform;

import '../domain/services/push_token_provider.dart';

/// No-op push provider: requests no permission and yields no token, so device
/// registration is skipped and nothing is faked. Replace with a
/// `firebase_messaging` + `permission_handler` implementation once the Firebase
/// project + native config exist (see docs/mobile-backend-readiness.md).
class NoopPushTokenProvider implements PushTokenProvider {
  const NoopPushTokenProvider();

  @override
  Future<bool> requestPermission() async => false;

  @override
  Future<String?> getToken() async => null;

  @override
  String get platform {
    if (Platform.isIOS) return 'ios';
    if (Platform.isAndroid) return 'android';
    return 'web';
  }
}
