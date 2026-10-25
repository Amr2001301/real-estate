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

  // MA2 — a company's own app is built locked to its company.
  group('CustomerTenantStorage locked to a company', () {
    late SharedPreferences prefs;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      prefs = await SharedPreferences.getInstance();
    });

    test('reports the locked company with nothing stored', () {
      final s = CustomerTenantStorage(
        prefs,
        lockedSlug: 'acme',
        lockedName: 'Acme Homes',
      );
      expect(s.isLocked, isTrue);
      expect(s.selectedCompanySlug, 'acme');
      expect(s.selectedCompanyName, 'Acme Homes');
      expect(s.hasSelectedCompany, isTrue);
    });

    test('a stored pick of another company does not change it', () async {
      final s = CustomerTenantStorage(prefs, lockedSlug: 'acme');
      await s.saveSelectedCompany(slug: 'other', name: 'Other Co');
      expect(s.selectedCompanySlug, 'acme');
    });

    test('clearing keeps the locked company', () async {
      final s = CustomerTenantStorage(prefs, lockedSlug: 'acme');
      await s.clearSelectedCompany();
      expect(s.selectedCompanySlug, 'acme');
      expect(s.hasSelectedCompany, isTrue);
    });

    test('the shared app (no lock) is unchanged', () {
      final s = CustomerTenantStorage(prefs, lockedSlug: '', lockedName: 'x');
      expect(s.isLocked, isFalse);
      expect(s.selectedCompanySlug, isNull);
      expect(s.selectedCompanyName, isNull);
    });
  });
}
