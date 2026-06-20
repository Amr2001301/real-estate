import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show debugPrint;

import '../domain/services/push_token_provider.dart';

/// Real FCM push token provider for the Staff App. Replaces [NoopPushTokenProvider]
/// once firebase_options.dart is generated and native config files are in place.
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
