import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/dashboard/admin_home/admin_home_data.dart';
import 'package:mobile_staff/features/dashboard/admin_home/admin_home_screen.dart';
import 'package:mobile_staff/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:mobile_staff/features/notifications/domain/usecases/notification_use_cases.dart';
import 'package:mobile_staff/features/notifications/presentation/cubit/unread_count_cubit.dart';

/// The company admin's home: the admin summary's figures, as on the website.

const _summary = <String, dynamic>{
  'kpis': {
    'totalUnits': 52,
    'availableUnits': 21,
    'soldUnits': 26,
    'reservedUnits': 5,
    'newLeadsThisMonth': 19,
    'signedContracts': 24,
  },
  'funnel': {'leads': 75, 'visits': 36, 'reservations': 32, 'contracts': 24},
  'financial': {
    'totalContractValue': '122460000',
    'totalCollectedVerified': 18000000,
    'collectedTowardsPrice': 17660000,
    'overdueTowardsPrice': 467200,
    'dueToDate': 18200000,
    'collectedAgainstDue': 17660000,
    'overdueTotal': 500000,
    'pendingBrokerPayouts': 266130,
    'collectedThisMonth': 2560000,
    'prevMonthCollected': 100000,
    'signedContractsThisMonth': 5,
    'prevMonthSignedContracts': 4,
    'prevMonthNewLeads': 20,
  },
  'cashflowForecast': {'next30': 1790000, 'next3160': 0, 'next6190': 0},
  'portfolio': {'paid': 17000000, 'awaiting': 600000, 'overdue': 467200, 'notYetDue': 100000000, 'unscheduled': 0},
  'topProjects': [
    {'id': 'p1', 'name': 'مشروع النخيل', 'totalUnits': 20, 'availableUnits': 8, 'reservedUnits': 2, 'soldUnits': 10, 'signedContracts': 9, 'contractValue': 50000000},
  ],
  'leadSources': [
    {'source': 'فيسبوك', 'count': 30},
    {'source': 'موقع', 'count': 12},
  ],
  'reservationTrend': [
    {'month': '2026-06', 'label': 'يونيو', 'value': 2},
    {'month': '2026-07', 'label': 'يوليو', 'value': 2},
    {'month': '2026-08', 'label': 'أغسطس', 'value': 4},
    {'month': '2026-09', 'label': 'سبتمبر', 'value': 4},
    {'month': '2026-10', 'label': 'أكتوبر', 'value': 13},
    {'month': '2026-11', 'label': 'نوفمبر', 'value': 3},
  ],
  'recentActivity': [
    {'id': 'visit:1', 'type': 'visit', 'title': 'رانيا غالي', 'action': 'طلب زيارة', 'context': null, 'createdAt': '2026-11-04T09:00:00Z'},
    {'id': 'lead:2', 'type': 'lead', 'title': 'طارق رزق', 'action': 'فرصة جديدة', 'context': null, 'createdAt': '2026-11-04T08:00:00Z'},
  ],
  'alerts': {
    'contractsAwaitingSignature': 2,
    'depositsPendingReview': 0,
    'openMaintenance': 5,
    'visitsAwaitingConfirmation': 7,
    'infoRequestsOpen': 3,
  },
};

AdminHome _home() => AdminHome.fromJson(
      _summary,
      sales: const [
        {'salesId': 'r2', 'salesName': 'هالة عبد الرحمن', 'achievedAmount': 4960000, 'signedContractsCount': 1},
        {'salesId': 'r1', 'salesName': 'عمر الشناوي', 'achievedAmount': '5920000', 'signedContractsCount': 1},
      ],
      brokers: const [
        {'brokerId': 'b1', 'companyName': 'بيت الخبرة للتسويق العقاري', 'contractsSigned': 3, 'salesGross': '15840000', 'commissionNet': '396000'},
      ],
      overdueFollowUps: 13,
    );

class _Repo implements AdminHomeRepository {
  @override
  Future<Result<AdminHome>> load({DateTime? now}) async => Ok(_home());
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _Notifs implements NotificationsRepository {
  @override
  Future<Result<int>> getUnreadCount() async => const Ok(0);
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

void main() {
  test('reads the admin summary as the website does', () {
    final h = _home();
    expect(h.contractValue, 122460000);
    expect(h.collected, 17660000); // towards the price, not all money in
    expect(h.overdue, 467200);
    expect(h.collectionRate, 97); // collected against what is due by today
    expect(h.funnel, [75, 36, 32, 24]);
    expect(h.trend.first.$1, DateTime(2026, 6));
    expect(h.topSales.first.name, 'عمر الشناوي'); // highest sales first
    expect(h.topBrokers.single.commission, 396000);
    expect(h.projects.single.sold, 10);
    expect(h.leadSources.first, ('فيسبوك', 30));
    expect(h.forecast, [1790000, 0, 0]);
    expect(h.portfolio!.total, 118067200);
  });

  test('nothing due yet: no collection rate', () {
    final h = AdminHome.fromJson(const {'financial': {'dueToDate': 0}});
    expect(h.collectionRate, isNull);
    expect(h.funnel, [0, 0, 0, 0]);
  });

  testWidgets('the admin sees the value, the month, actions, rankings and activity', (t) async {
    t.view.physicalSize = const Size(390 * 3, 4200 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final cubit = AdminHomeCubit(_Repo());
    addTearDown(cubit.close);
    final session = SessionCubit(TokenStorage())
      ..adopt(const Session(userId: 'a1', role: AppRole.admin, displayName: 'Platform Admin'));
    addTearDown(session.close);
    await t.pumpWidget(MultiBlocProvider(
      providers: [
        BlocProvider.value(value: session),
        BlocProvider(create: (_) => UnreadCountCubit(GetUnreadCount(_Notifs()))),
        BlocProvider.value(value: cubit),
      ],
      child: MaterialApp(
        theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const AdminHomeScreen(),
      ),
    ));
    await t.pumpAndSettle();

    expect(find.text('قيمة العقود'), findsOneWidget);
    expect(find.textContaining('97%'), findsOneWidget);
    expect(find.byKey(const Key('home-action-payment')), findsOneWidget);
    expect(find.byKey(const Key('home-action-ledger')), findsOneWidget);
    expect(find.text('الشركة هذا الشهر'), findsOneWidget);
    expect(find.text('محصَّل هذا الشهر (مليون)'), findsOneWidget);
    expect(find.byKey(const Key('home-att-sign')), findsOneWidget);
    expect(find.byKey(const Key('home-att-follow-ups')), findsOneWidget);
    expect(find.text('مسار التحويل'), findsOneWidget);
    expect(find.text('أكتوبر'), findsOneWidget);
    expect(find.byKey(const Key('home-rank-r1')), findsOneWidget);
    expect(find.textContaining('عمولة'), findsOneWidget);
    for (final k in ['ah-project-p1', 'ah-finance-health', 'ah-cash-flow', 'ah-lead-sources']) {
      await t.scrollUntilVisible(find.byKey(Key(k)), 300, scrollable: find.byType(Scrollable).first);
      expect(find.byKey(Key(k)), findsOneWidget);
    }
    await t.scrollUntilVisible(find.text('رانيا غالي'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('رانيا غالي'), findsOneWidget);
    expect(find.text('طلب زيارة'), findsOneWidget);
  });

  test('times read as on the website', () {
    final l10n = lookupAppLocalizations(const Locale('ar'));
    final now = DateTime(2026, 11, 4, 12);
    expect(adminAgo(l10n, now, now), 'الآن');
    expect(adminAgo(l10n, now.subtract(const Duration(hours: 1)), now), 'منذ ساعة');
    expect(adminAgo(l10n, now.subtract(const Duration(days: 3)), now), 'منذ 3 أيام');
  });

  test("last month's collection reads in this month's unit", () {
    expect(adminInUnit(176090, 2760000), '0.18');
    expect(adminInUnit(100000, 2560000), '0.1');
    expect(adminInUnit(4000, 600), '4000');
  });
}
