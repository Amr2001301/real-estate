import 'package:core/core_domain.dart';

import '../entities/app_notification.dart';

abstract interface class NotificationsRepository {
  Future<Result<List<AppNotification>>> getNotifications();
  Future<Result<int>> getUnreadCount();
  Future<Result<void>> markRead(String id);
  Future<Result<void>> markAllRead();

  /// Registers a device FCM token with the backend so the user receives push
  /// notifications on this device. No-op if [token] is empty.
  Future<Result<void>> registerDevice(String token, String platform);

  /// Signs this device out of push: the backend stops sending the current
  /// user's notifications to [token]. Called before logout.
  Future<Result<void>> unregisterDevice(String token);
}
