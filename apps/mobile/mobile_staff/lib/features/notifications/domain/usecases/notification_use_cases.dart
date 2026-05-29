import 'package:core/core_domain.dart';

import '../entities/app_notification.dart';
import '../repositories/notifications_repository.dart';

class GetNotifications implements UseCase<List<AppNotification>, NoParams> {
  const GetNotifications(this._repo);
  final NotificationsRepository _repo;
  @override
  Future<Result<List<AppNotification>>> call(NoParams params) =>
      _repo.getNotifications();
}

class GetUnreadCount implements UseCase<int, NoParams> {
  const GetUnreadCount(this._repo);
  final NotificationsRepository _repo;
  @override
  Future<Result<int>> call(NoParams params) => _repo.getUnreadCount();
}

class MarkNotificationRead implements UseCase<void, String> {
  const MarkNotificationRead(this._repo);
  final NotificationsRepository _repo;
  @override
  Future<Result<void>> call(String id) => _repo.markRead(id);
}

class MarkAllNotificationsRead implements UseCase<void, NoParams> {
  const MarkAllNotificationsRead(this._repo);
  final NotificationsRepository _repo;
  @override
  Future<Result<void>> call(NoParams params) => _repo.markAllRead();
}
