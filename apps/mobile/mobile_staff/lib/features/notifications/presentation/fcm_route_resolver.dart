import 'package:firebase_messaging/firebase_messaging.dart';

import 'notification_route.dart';

/// Maps an FCM [RemoteMessage] to an in-app navigation route for the Staff App.
///
/// Data keys (set by the backend):
///  - `templateCode` — notification type
///  - `entityType`   — e.g. "maintenance", "lead", "visit"
///  - `entityId`     — UUID of the target entity
///
/// Returns null when no specific screen applies.
String? resolveStaffFcmRoute(RemoteMessage message, {bool isBroker = false}) {
  final code = message.data['templateCode'] as String? ?? '';
  return staffNotificationRoute(code, message.data, isBroker: isBroker);
}
