import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/brokers_admin/broker_actions.dart';
import 'package:mobile_staff/features/brokers_admin/brokers_hub_screen.dart';
import 'package:mobile_staff/features/permissions/staff_permissions.dart';

/// Records every request and answers 200.
class _Adapter implements HttpClientAdapter {
  final calls = <String>[];
  final bodies = <Object?>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<List<int>>? requestStream, Future<void>? cancelFuture) async {
    calls.add('${options.method} ${options.path}');
    bodies.add(options.data);
    return ResponseBody.fromString('{}', 200, headers: {Headers.contentTypeHeader: ['application/json']});
  }

  @override
  void close({bool force = false}) {}
}

Widget _app(Widget child) => MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    );

void main() {
  test('which actions each state offers', () {
    expect(brokerActionsFor(BrokerTab.commissions, 'PENDING'), [BrokerAction.approve, BrokerAction.reject]);
    expect(brokerActionsFor(BrokerTab.commissions, 'APPROVED'), [BrokerAction.cancel]);
    expect(brokerActionsFor(BrokerTab.commissions, 'REJECTED'), isEmpty);
    expect(brokerActionsFor(BrokerTab.leads, 'PENDING'), [BrokerAction.approve, BrokerAction.reject, BrokerAction.markDuplicate]);
    expect(brokerActionsFor(BrokerTab.payouts, 'DRAFT'), [BrokerAction.approve, BrokerAction.cancel]);
    expect(brokerActionsFor(BrokerTab.payouts, 'PROCESSING'), [BrokerAction.markPaid, BrokerAction.cancel]);
    expect(brokerActionsFor(BrokerTab.payouts, 'PAID'), isEmpty);
    expect(brokerActionsFor(BrokerTab.firms, 'ACTIVE', hold: true), [BrokerAction.suspend, BrokerAction.holdOff, BrokerAction.terminate]);
    expect(brokerActionsFor(BrokerTab.firms, 'SUSPENDED'), [BrokerAction.activate, BrokerAction.holdOn, BrokerAction.terminate]);
    expect(brokerActionsFor(BrokerTab.contracts, 'yes'), isEmpty);
  });

  test('strict codes are never opened by the admin role alone', () {
    const none = StaffPermissions();
    expect(canRunBrokerCode(AppRole.admin, none, 'broker_payouts:pay'), isFalse);
    expect(canRunBrokerCode(AppRole.admin, none, 'brokers:update'), isTrue);
    expect(canRunBrokerCode(AppRole.admin, const StaffPermissions({'broker_payouts:pay'}), 'broker_payouts:pay'), isTrue);
    expect(canRunBrokerCode(AppRole.sales, none, 'brokers:update'), isFalse);
    expect(canRunBrokerCode(AppRole.admin, none, ''), isFalse);
  });

  test('each action goes to the API route and body the website uses', () async {
    final adapter = _Adapter();
    final repo = BrokersAdminRepository(Dio()..httpClientAdapter = adapter);
    await repo.act(BrokerTab.commissions, 'c1', BrokerAction.approve);
    await repo.act(BrokerTab.commissions, 'c1', BrokerAction.reject, reason: 'سبب');
    await repo.act(BrokerTab.leads, 'l1', BrokerAction.markDuplicate);
    await repo.act(BrokerTab.payouts, 'p1', BrokerAction.markPaid, method: 'CHEQUE', reference: ' 123 ');
    await repo.act(BrokerTab.firms, 'f1', BrokerAction.holdOn);
    await repo.act(BrokerTab.firms, 'f1', BrokerAction.activate);
    expect(adapter.calls, [
      'PATCH /broker-commissions/c1/approve',
      'PATCH /broker-commissions/c1/reject',
      'PATCH /broker-leads/l1/mark-duplicate',
      'PATCH /broker-payouts/p1/mark-paid',
      'POST /brokers/f1/payout-hold',
      'PATCH /brokers/f1/status',
    ]);
    expect(adapter.bodies[1], {'reason': 'سبب'});
    expect(adapter.bodies[3], {'paymentMethod': 'CHEQUE', 'paymentReference': '123'});
    expect(adapter.bodies[4], {'hold': true});
    expect(adapter.bodies[5], {'status': 'ACTIVE'});
  });

  testWidgets('the detail sheet shows facts, and rejecting asks for a reason first', (t) async {
    final adapter = _Adapter();
    final repo = BrokersAdminRepository(Dio()..httpClientAdapter = adapter);
    final row = BrokerRow.fromJson(
      BrokerTab.commissions,
      const {'id': 'c1', 'commissionNumber': 'COM-1', 'status': 'PENDING', 'netAmount': '45000', 'grossAmount': '50000', 'broker': {'companyName': 'بيت الخبرة'}},
      'ar',
    );
    await t.pumpWidget(_app(Builder(
      builder: (ctx) => Scaffold(
        body: TextButton(
          key: const Key('open'),
          onPressed: () => showBrokerDetail(ctx, tab: BrokerTab.commissions, row: row, repository: repo, can: (_) => true),
          child: const Text('open'),
        ),
      ),
    )));
    await t.tap(find.byKey(const Key('open')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('broker-detail')), findsOneWidget);
    expect(find.text('بيت الخبرة'), findsWidgets); // under the title and in the facts
    expect(find.byKey(const Key('broker-act-approve')), findsOneWidget);
    await t.tap(find.byKey(const Key('broker-act-reject')));
    await t.pumpAndSettle();
    // The reason is required: the confirm button waits for text.
    final okBtn = find.byKey(const Key('broker-question-ok'));
    await t.tap(okBtn);
    await t.pump();
    expect(adapter.calls, isEmpty); // nothing is sent without the reason
    await t.enterText(find.byKey(const Key('broker-reason')), 'مخالف');
    await t.pump();
    await t.tap(find.byKey(const Key('broker-question-ok')));
    await t.pumpAndSettle();
    expect(adapter.calls, ['PATCH /broker-commissions/c1/reject']);
  });

  testWidgets('without the codes the sheet shows facts but no buttons', (t) async {
    final repo = BrokersAdminRepository(Dio()..httpClientAdapter = _Adapter());
    final row = BrokerRow.fromJson(BrokerTab.payouts, const {'id': 'p1', 'payoutNumber': 'PO-1', 'status': 'DRAFT', 'totalNet': '1000'}, 'ar');
    await t.pumpWidget(_app(Builder(
      builder: (ctx) => Scaffold(
        body: TextButton(
          key: const Key('open'),
          onPressed: () => showBrokerDetail(ctx, tab: BrokerTab.payouts, row: row, repository: repo, can: (_) => false),
          child: const Text('open'),
        ),
      ),
    )));
    await t.tap(find.byKey(const Key('open')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('broker-detail')), findsOneWidget);
    expect(find.byKey(const Key('broker-act-approve')), findsNothing);
  });
}
