import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/notifications/data/notification_preferences_api.dart';

void main() {
  group('NotificationPreferencesApi.parse', () {
    test('anything not explicitly off is on', () {
      final prefs = NotificationPreferencesApi.parse({
        'email': {'finance': false},
        'push': <String, dynamic>{},
      });
      expect(prefs['email']!['finance'], isFalse);
      expect(prefs['email']!['sales'], isTrue);
      expect(prefs['push']!['maintenance'], isTrue);
    });

    test('no stored preferences means every channel on', () {
      final prefs = NotificationPreferencesApi.parse(null);
      for (final channel in prefChannels) {
        for (final group in prefGroups) {
          expect(prefs[channel]![group], isTrue);
        }
      }
    });
  });
}
