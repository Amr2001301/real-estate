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

class RegisterDeviceParams {
  const RegisterDeviceParams({required this.token, required this.platform});
  final String token;
  final String platform;
}

/// Scaffolded device-registration use case (not invoked until FCM is wired).
class RegisterDevice implements UseCase<void, RegisterDeviceParams> {
  const RegisterDevice(this._repo);
  final NotificationsRepository _repo;
  @override
  Future<Result<void>> call(RegisterDeviceParams params) =>
      _repo.registerDevice(params.token, params.platform);
}
