import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/storage/customer_tenant_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late CustomerTenantStorage storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    storage = CustomerTenantStorage(prefs);
  });

  group('CustomerTenantStorage', () {
    test('starts empty', () {
      expect(storage.selectedCompanySlug, isNull);
      expect(storage.selectedCompanyName, isNull);
      expect(storage.hasSelectedCompany, isFalse);
    });

    test('saveSelectedCompany persists slug and name', () async {
      await storage.saveSelectedCompany(slug: 'acme', name: 'Acme Developers');
      expect(storage.selectedCompanySlug, 'acme');
      expect(storage.selectedCompanyName, 'Acme Developers');
      expect(storage.hasSelectedCompany, isTrue);
    });

    test('clearSelectedCompany removes both keys', () async {
      await storage.saveSelectedCompany(slug: 'acme', name: 'Acme');
      await storage.clearSelectedCompany();
      expect(storage.selectedCompanySlug, isNull);
      expect(storage.selectedCompanyName, isNull);
      expect(storage.hasSelectedCompany, isFalse);
    });

    test('overwriting keeps the latest values', () async {
      await storage.saveSelectedCompany(slug: 'first', name: 'First Co');
      await storage.saveSelectedCompany(slug: 'second', name: 'Second Co');
      expect(storage.selectedCompanySlug, 'second');
      expect(storage.selectedCompanyName, 'Second Co');
    });

    test('keys are namespaced under customer.* — no collision with auth.*', () async {
      SharedPreferences.setMockInitialValues({
        'auth.selectedCompanySlug': 'staff-tenant',
      });
      final prefs = await SharedPreferences.getInstance();
      final s = CustomerTenantStorage(prefs);
      expect(s.selectedCompanySlug, isNull);
    });
  });
}
