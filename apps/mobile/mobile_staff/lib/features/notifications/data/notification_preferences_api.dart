import 'package:core/core.dart';
import 'package:dio/dio.dart';

/// Notification groups and channels a user can switch off. In-app
/// notifications always arrive; only the e-mail / push copies are optional.
const prefGroups = ['sales', 'finance', 'maintenance', 'account'];
const prefChannels = ['email', 'push'];

/// channel → group → on/off.
typedef NotificationPrefs = Map<String, Map<String, bool>>;

/// The signed-in user's own e-mail / push preferences per group.
class NotificationPreferencesApi {
  NotificationPreferencesApi(this._dio);
  final Dio _dio;

  static const _path = '/users/me/notification-preferences';

  Future<Result<NotificationPrefs>> load() => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>(_path);
        return parse(res.data);
      });

  /// Saves one switch; the server keeps every other group as it was.
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
