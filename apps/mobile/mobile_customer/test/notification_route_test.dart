import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/notifications/presentation/notification_route.dart';

void main() {
  group('customerNotificationRoute', () {
    test('an installment notice filed under its contract opens installments', () {
      expect(
        customerNotificationRoute('installment_overdue', {
          'entityType': 'contract',
          'entityId': 'c-1',
          'installmentId': 'i-1',
        }),
        '/account/installments',
      );
    });

    test('only list screens: detail screens need the loaded object', () {
      expect(
        customerNotificationRoute('maintenance_request_resolved', {
          'entityType': 'maintenance',
          'entityId': 'mr-1',
        }),
        '/account/maintenance',
      );
      expect(customerNotificationRoute('contract_number_assigned', {'entityId': 'c-1'}),
          '/account/contracts');
      expect(customerNotificationRoute('deposit_reversed', {'entityType': 'contract'}),
          '/account/deposits');
    });

    test('push data and in-app payloads resolve the same way', () {
      const data = {'entityType': 'reservation', 'entityId': 'r-1'};
      expect(customerNotificationRoute('reservation_expired', data), '/account/finance');
      expect(customerNotificationRoute('any_code', data), '/account/finance');
    });

    test('visit and inquiry requests open the requests screen', () {
      expect(customerNotificationRoute('visit_scheduled', const {}), '/account/requests');
      expect(customerNotificationRoute('info_request_status_changed', const {}),
          '/account/requests');
    });

    test('unknown notices have no route', () {
      expect(customerNotificationRoute('user_account_created', const {}), isNull);
    });
  });
}
