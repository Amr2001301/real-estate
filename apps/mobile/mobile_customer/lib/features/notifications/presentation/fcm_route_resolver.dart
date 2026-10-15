import 'package:firebase_messaging/firebase_messaging.dart';

import 'notification_route.dart';

/// Maps an FCM [RemoteMessage] to an in-app navigation route.
///
/// The backend sends two data keys in every push:
///  - `templateCode` — identifies the notification type
///  - `notificationId` — DB row id (reserved for future use)
///
/// Optional deep-link keys (added by the backend when present):
///  - `entityType` — e.g. "maintenance", "contract", "deposit"
///  - `entityId`   — UUID of the target entity
///
/// Returns null when no specific screen applies (navigator stays on current
/// route; user can open the notification list to see the new item).
String? resolveFcmRoute(RemoteMessage message) {
  final code = message.data['templateCode'] as String? ?? '';
  return customerNotificationRoute(code, message.data);
}
