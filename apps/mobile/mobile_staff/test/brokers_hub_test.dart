import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/brokers_admin/brokers_hub_screen.dart';
import 'package:mobile_staff/features/permissions/staff_permissions.dart';

class _Repo implements BrokersAdminRepository {
  final calls = <String>[];

  @override
  Future<Result<Paginated<BrokerRow>>> list(BrokerTab tab, {String? status, int page = 1, String lang = 'ar'}) async {
    calls.add('${tab.name}:${status ?? '-'}');
    final rows = switch (tab) {
      BrokerTab.firms => [
          BrokerRow.fromJson(tab, const {'id': 'f1', 'companyName': 'بيت الخبرة', 'code': 'BRK-1', 'city': 'القاهرة', 'status': 'ACTIVE', 'defaultCommissionPct': '2.5', 'payoutHold': true}, 'ar'),
        ],
      BrokerTab.commissions => [
          BrokerRow.fromJson(tab, const {'id': 'c1', 'commissionNumber': 'COM-1', 'status': 'PENDING', 'netAmount': '45000', 'broker': {'companyName': 'بيت الخبرة'}}, 'ar'),
        ],
      _ => <BrokerRow>[],
    };
    return Ok(Paginated(data: rows, meta: PageMeta(page: 1, pageSize: 20, total: rows.length, totalPages: 1)));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Widget _app(Widget child) => MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    );

void main() {
  test('each tab opens by its own code; the admin sees all', () {
    expect(brokerTabsFor(AppRole.admin, const StaffPermissions()), BrokerTab.values);
    expect(brokerTabsFor(AppRole.sales, const StaffPermissions({'broker_leads:read', 'broker_contracts:read'})), [BrokerTab.leads, BrokerTab.contracts]);
    expect(brokerTabsFor(AppRole.sales, const StaffPermissions()), isEmpty);
    expect(StaffAccess.brokers(AppRole.sales, const StaffPermissions({'broker_payouts:read'})), isTrue);
    expect(StaffAccess.brokers(AppRole.salesManager, const StaffPermissions()), isFalse);
  });

  test('a contract is signed or awaiting by its signing date; a lead defaults to pending', () {
    final signed = BrokerRow.fromJson(BrokerTab.contracts, const {'id': 'a', 'contractNumber': 'C-1', 'signedAt': '2026-11-01T10:00:00Z', 'totalAmount': '1000000'}, 'ar');
    final open = BrokerRow.fromJson(BrokerTab.contracts, const {'id': 'b', 'totalAmount': 5}, 'ar');
    expect((signed.status, open.status), ('yes', 'no'));
    expect(BrokerRow.fromJson(BrokerTab.leads, const {'id': 'l', 'fullName': 'س'}, 'ar').status, 'PENDING');
  });

  testWidgets('tabs switch lists, the filter sheet narrows one', (t) async {
    final repo = _Repo();
    await t.pumpWidget(_app(BrokersHubScreen(repository: repo, tabs: BrokerTab.values)));
    await t.pumpAndSettle();
    expect(find.text('بيت الخبرة'), findsOneWidget);
    expect(find.text('مدفوعاتها موقوفة'), findsOneWidget);
    await t.tap(find.byKey(const Key('home-pill-commissions')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('broker-commissions-c1')), findsOneWidget);
    await t.tap(find.byKey(const Key('brokers-filters')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('broker-filter-PENDING')));
    await t.tap(find.byKey(const Key('filter-apply')));
    await t.pumpAndSettle();
    expect(repo.calls, ['firms:-', 'commissions:-', 'commissions:PENDING']);
  });
}
