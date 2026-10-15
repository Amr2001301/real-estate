import 'package:core/core_domain.dart';

import '../entities/app_notification.dart';

abstract interface class NotificationsRepository {
  Future<Result<List<AppNotification>>> getNotifications();
  Future<Result<int>> getUnreadCount();
  Future<Result<void>> markRead(String id);
  Future<Result<void>> markAllRead();

  /// Scaffolded: registers an FCM device token. Not invoked automatically yet
  /// (push delivery is not wired backend-side — see backend gaps).
  Future<Result<void>> registerDevice(String token, String platform);

  /// Signs this device out of push: the backend stops sending the current
  /// user's notifications to [token]. Called before logout.
  Future<Result<void>> unregisterDevice(String token);
}
