import 'package:core/core_domain.dart';

import '../entities/app_notification.dart';

abstract interface class NotificationsRepository {
  Future<Result<List<AppNotification>>> getNotifications();
  Future<Result<int>> getUnreadCount();
  Future<Result<void>> markRead(String id);
  Future<Result<void>> markAllRead();
}
