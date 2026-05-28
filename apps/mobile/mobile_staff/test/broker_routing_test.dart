import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/router/app_router.dart';

void main() {
  const broker = SessionState.authenticated(Session(userId: '1', role: AppRole.broker));
  const sales = SessionState.authenticated(Session(userId: '2', role: AppRole.sales));

  group('staffRedirect — broker workspace', () {
    test('broker is sent into /broker/home from login/splash', () {
      expect(staffRedirect(broker, '/login'), '/broker/home');
      expect(staffRedirect(broker, '/splash'), '/broker/home');
    });

    test('broker stays within /broker/*', () {
      expect(staffRedirect(broker, '/broker/home'), isNull);
      expect(staffRedirect(broker, '/broker/leads/1'), isNull);
      expect(staffRedirect(broker, '/broker/commissions'), isNull);
    });

    test('broker is bounced out of Sales screens', () {
      expect(staffRedirect(broker, '/home'), '/broker/home');
      expect(staffRedirect(broker, '/leads/1'), '/broker/home');
      expect(staffRedirect(broker, '/visits'), '/broker/home');
    });

    test('sales is bounced out of the broker workspace', () {
      expect(staffRedirect(sales, '/broker/home'), '/home');
      expect(staffRedirect(sales, '/broker/commissions'), '/home');
    });

    test('sales stays on its own shell', () {
      expect(staffRedirect(sales, '/home'), isNull);
      expect(staffRedirect(sales, '/leads/1'), isNull);
    });

    test('unresolved → splash; customer-side → login', () {
      expect(staffRedirect(const SessionState.unknown(), '/broker/home'), '/splash');
      expect(
        staffRedirect(const SessionState.authenticated(Session(userId: '3', role: AppRole.customer)), '/broker/home'),
        '/login',
      );
    });
  });
}
