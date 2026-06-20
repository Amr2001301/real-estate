import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show debugPrint;

import '../domain/services/push_token_provider.dart';

/// Real FCM push token provider. Replaces [NoopPushTokenProvider] once
/// firebase_options.dart is generated and native config files are in place.
///
/// Permissions:
///  - Android 13+: requests POST_NOTIFICATIONS at runtime.
///  - iOS: requests alert+badge+sound via FirebaseMessaging directly.
///  - Denied → returns false; registration is skipped silently.
///
/// Token refresh is handled separately in [CustomerApp] via
/// FirebaseMessaging.instance.onTokenRefresh.
class FirebasePushTokenProvider implements PushTokenProvider {
  const FirebasePushTokenProvider();

  @override
  Future<bool> requestPermission() async {
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  @override
  Future<String?> getToken() async {
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (e) {
      debugPrint('[PushReg] FCM getToken() threw: $e');
      return null;
    }
  }

  @override
  String get platform {
    if (Platform.isIOS) return 'ios';
    if (Platform.isAndroid) return 'android';
    return 'web';
  }
}
