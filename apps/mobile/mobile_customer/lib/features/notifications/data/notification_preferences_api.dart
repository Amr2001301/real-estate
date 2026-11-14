import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../domain/notification_preferences.dart';

export '../domain/notification_preferences.dart';

/// The preferences over `/users/me/notification-preferences`.
class NotificationPreferencesApi implements NotificationPreferencesRepository {
  NotificationPreferencesApi(this._dio);
  final Dio _dio;

  static const _path = '/users/me/notification-preferences';

  @override
  Future<Result<NotificationPrefs>> load() => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>(_path);
        return parse(res.data);
      });

  @override
  Future<Result<NotificationPrefs>> set(String channel, String group, bool value) =>
      guardApiCall(() async {
        final res = await _dio.put<Map<String, dynamic>>(
          _path,
          data: {
            channel: {group: value},
          },
        );
        return parse(res.data);
      });

  /// Anything not explicitly off is on.
  static NotificationPrefs parse(Map<String, dynamic>? json) => {
        for (final channel in prefChannels)
          channel: {
            for (final group in prefGroups)
              group: (json?[channel] as Map<String, dynamic>?)?[group] != false,
          },
      };
}
