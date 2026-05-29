import 'package:core/core.dart';

import '../../domain/entities/app_notification.dart';
import '../../domain/repositories/notifications_repository.dart';
import '../datasources/notifications_remote_data_source.dart';
import '../mappers/notification_mapper.dart';

class NotificationsRepositoryImpl implements NotificationsRepository {
  NotificationsRepositoryImpl(this._remote);
  final NotificationsRemoteDataSource _remote;

  @override
  Future<Result<List<AppNotification>>> getNotifications() {
    return guardApiCall(() async {
      final dtos = await _remote.list();
      return dtos.map((d) => d.toEntity()).toList();
    });
  }

  @override
  Future<Result<int>> getUnreadCount() =>
      guardApiCall(() => _remote.unreadCount());

  @override
  Future<Result<void>> markRead(String id) =>
      guardApiCall(() => _remote.markRead(id));

  @override
  Future<Result<void>> markAllRead() =>
      guardApiCall(() => _remote.markAllRead());
}
