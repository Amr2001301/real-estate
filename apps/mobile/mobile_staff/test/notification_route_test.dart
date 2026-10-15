import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/notifications/presentation/notification_route.dart';

void main() {
  group('staffNotificationRoute', () {
    test('opens the entity the payload names', () {
      expect(
        staffNotificationRoute('maintenance_request_assigned', {
          'entityType': 'maintenance',
          'entityId': 'mr-1',
        }),
        '/maintenance/mr-1',
      );
      expect(
        staffNotificationRoute('lead_stage_changed', {'entityType': 'lead', 'entityId': 'l-1'}),
        '/leads/l-1',
      );
      expect(
        staffNotificationRoute('reservation_expired', {
          'entityType': 'reservation',
          'entityId': 'r-1',
        }),
        '/reservations/r-1',
      );
    });

    test('installment and contract notices open the contract', () {
      expect(
        staffNotificationRoute('installment_overdue_staff', {
          'entityType': 'contract',
          'entityId': 'c-1',
          'installmentId': 'i-1',
        }),
        '/contracts/c-1',
      );
    });

    test('money and bonus notices open their screens', () {
      expect(staffNotificationRoute('deposit_status_staff', {'entityType': 'contract'}), '/deposits');
      expect(staffNotificationRoute('cheque_status_staff', const {}), '/deposits');
      expect(staffNotificationRoute('payment_proof_submitted', const {}), '/payments-review');
      expect(staffNotificationRoute('bonus_status_changed', {'entityType': 'bonus'}), '/bonus');
    });

    test('a visit request id never opens an appointment', () {
      expect(
        staffNotificationRoute('visit_request_status_changed', {
          'entityType': 'visit_request',
          'entityId': 'vr-1',
        }),
        '/visits',
      );
    });

    test('a broker user gets the broker portal screens', () {
      expect(
        staffNotificationRoute(
          'reservation_status_changed',
          {'entityType': 'reservation', 'entityId': 'r-1'},
          isBroker: true,
        ),
        '/broker/reservations/r-1',
      );
      expect(
        staffNotificationRoute('lead_stage_changed', {'leadId': 'l-1'}, isBroker: true),
        '/broker/leads/l-1',
      );
      expect(
        staffNotificationRoute('broker_payout_paid', const {}, isBroker: true),
        '/broker/commissions',
      );
    });
  });
}
