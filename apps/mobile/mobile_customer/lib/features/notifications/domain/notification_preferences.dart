import 'package:core/core.dart';

/// Notification groups and channels a user can switch off. In-app
/// notifications always arrive; only the e-mail / push copies are optional.
const prefGroups = ['sales', 'finance', 'maintenance', 'account'];
const prefChannels = ['email', 'push'];

/// channel → group → on/off.
typedef NotificationPrefs = Map<String, Map<String, bool>>;

/// The signed-in user's own e-mail / push preferences per group.
abstract class NotificationPreferencesRepository {
  Future<Result<NotificationPrefs>> load();

  /// Saves one switch; the server keeps every other group as it was.
  Future<Result<NotificationPrefs>> set(String channel, String group, bool value);
}
