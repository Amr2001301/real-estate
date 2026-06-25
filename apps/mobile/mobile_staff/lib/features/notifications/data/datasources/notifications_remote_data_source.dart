import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../dtos/notification_dto.dart';

/// Raw network access to notification endpoints (authenticated). May throw.
abstract interface class NotificationsRemoteDataSource {
  Future<List<NotificationDto>> list();
  Future<int> unreadCount();
  Future<void> markRead(String id);
  Future<void> markAllRead();
  Future<void> registerDevice(String token, String platform);
}

class NotificationsRemoteDataSourceImpl implements NotificationsRemoteDataSource {
  NotificationsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<NotificationDto>> list() async {
    final res = await _dio.get<Map<String, dynamic>>('/me/notifications');
    final data = (res.data?['data'] as List?) ?? const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(NotificationDto.fromJson)
        .toList();
  }

  @override
  Future<int> unreadCount() async {
    final res = await _dio.get<dynamic>('/me/notifications/unread-count');
    assert(() {
      debugPrint('[NotificationsDS] unreadCount: ${res.data} (${res.data?.runtimeType})');
      return true;
    }());
    return parseUnreadCount(res.data);
  }

  @visibleForTesting
  static int parseUnreadCount(dynamic data) {
    if (data is int) return data;
    if (data is num) return data.toInt();
    if (data is String) return int.tryParse(data) ?? 0;
    if (data is Map<String, dynamic>) {
      final v = data['count'] ?? data['unreadCount'] ?? data['unread_count'];
      if (v is int) return v;
      if (v is num) return v.toInt();
      if (v is String) return int.tryParse(v) ?? 0;
    }
    return 0;
  }

  @override
  Future<void> markRead(String id) async {
    await _dio.patch<dynamic>('/me/notifications/$id/read');
  }

  @override
  Future<void> markAllRead() async {
    await _dio.patch<dynamic>('/me/notifications/read-all');
  }

  @override
  Future<void> registerDevice(String token, String platform) async {
    await _dio.post<dynamic>('/me/devices', data: {'token': token, 'platform': platform});
  }
}
