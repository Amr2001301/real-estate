import 'package:dio/dio.dart';

import '../dtos/notification_dto.dart';

/// Raw network access to notification endpoints (authenticated). May throw.
abstract interface class NotificationsRemoteDataSource {
  Future<List<NotificationDto>> list();
  Future<int> unreadCount();
  Future<void> markRead(String id);
  Future<void> markAllRead();
}

class NotificationsRemoteDataSourceImpl implements NotificationsRemoteDataSource {
  NotificationsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<NotificationDto>> list() async {
    // Paginated shape: { data: [...], meta }.
    final res = await _dio.get<Map<String, dynamic>>('/me/notifications');
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(NotificationDto.fromJson)
        .toList();
  }

  @override
  Future<int> unreadCount() async {
    final res = await _dio.get<Map<String, dynamic>>('/me/notifications/unread-count');
    return (res.data?['count'] as num?)?.toInt() ?? 0;
  }

  @override
  Future<void> markRead(String id) async {
    await _dio.patch<dynamic>('/me/notifications/$id/read');
  }

  @override
  Future<void> markAllRead() async {
    await _dio.patch<dynamic>('/me/notifications/read-all');
  }
}
