import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/dashboard/sales_home/sales_home_cubit.dart';
import 'package:mobile_staff/features/dashboard/sales_home/sales_home_data.dart';
import 'package:mobile_staff/features/dashboard/sales_home/sales_home_screen.dart';
import 'package:mobile_staff/features/leads/domain/entities/lead.dart';
import 'package:mobile_staff/features/leads/domain/repositories/leads_repository.dart';
import 'package:mobile_staff/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:mobile_staff/features/notifications/domain/usecases/notification_use_cases.dart';
import 'package:mobile_staff/features/notifications/presentation/cubit/unread_count_cubit.dart';

/// Screen 49 — the sales rep's home shows the website's figures in the
/// owner-approved design.

final _now = DateTime.now();

SalesHome _home({int stale = 2, List<AgendaEvent>? visits}) => SalesHome(
      openLeads: 8,
      staleLeads: stale,
      stages: const {'NEW': 3, 'INTERESTED': 1, 'VISIT': 2, 'NEGOTIATION': 2, 'WON': 5, 'LOST': 1},
      activeReservations: 1,
      expiring: const [],
      visits: visits ??
          [
            AgendaEvent(
              kind: AgendaKind.visit,
              id: 'v1',
              at: DateTime(_now.year, _now.month, _now.day, 12),
              title: 'عادل السيد',
              place: 'مكتب المبيعات',
            ),
          ],
      unconfirmedVisits: 1,
      performance: const SalesPerformanceRow(
        achievedAmount: 4320000,
        achievedUnits: 1,
        signedContracts: 1,
        realizedValue: 4320000,
        targetAmount: 8000000,
        targetUnits: 2,
        targetPercent: 54,
      ),
      companyName: 'شركة ديمو',
    );

class _Repo implements SalesHomeRepository {
  _Repo(this.home);
  final SalesHome home;
  @override
  Future<Result<SalesHome>> load({required String userId, DateTime? now}) async => Ok(home);
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _Leads implements LeadsRepository {
  _Leads({this.summary = const FollowUpSummary(today: 1)});
  final FollowUpSummary summary;
  final asked = <FollowUpBucket>[];

  @override
  Future<Result<FollowUpSummary>> getFollowUpSummary() async => Ok(summary);

  @override
  Future<Result<Paginated<FollowUp>>> getFollowUps(FollowUpBucket bucket, {int page = 1}) async {
    asked.add(bucket);
    final items = [
      FollowUp(
        lead: Lead(
          id: 'l1',
          fullName: 'أمل شاكر',
          stage: 'NEW',
          phone: '+201000000000',
          nextActionAt: _now,
          nextActionType: 'CALL',
          nextActionNote: 'أول اتصال',
        ),
      ),
    ];
    return Ok(Paginated(data: items, meta: PageMeta(page: 1, pageSize: 20, total: 1, totalPages: 1)));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _Notifs implements NotificationsRepository {
  @override
  Future<Result<int>> getUnreadCount() async => const Ok(0);
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Future<void> _pump(WidgetTester t, SalesHomeCubit cubit) async {
  t.view.physicalSize = const Size(390 * 3, 2600 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
  final session = SessionCubit(TokenStorage())
    ..adopt(const Session(userId: 'u1', role: AppRole.sales, displayName: 'محمود البنا'));
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
      home: const SalesHomeScreen(),
    ),
  ));
  await t.pumpAndSettle();
}

void main() {
  test('the target row reads the API', () {
    final p = SalesPerformanceRow.fromJson(const {
      'achievedAmount': '4320000',
      'achievedUnits': 1,
      'signedContractsCount': 2,
      'realizedValue': 6000000,
      'targetAmount': 8000000,
      'targetUnits': 2,
      'targetAmountPercent': 54,
    });
    expect(p.achievedAmount, 4320000);
    expect(p.hasTarget, isTrue);
    expect(p.averageDeal, 3000000);
  });

  test('overdue follow-ups come first when there are any', () async {
    final leads = _Leads(summary: const FollowUpSummary(overdue: 2, today: 1));
    final cubit = SalesHomeCubit(_Repo(_home()), leads, userId: 'u1');
    await cubit.load();
    expect(cubit.state.followUpBucket, FollowUpBucket.overdue);
    expect(leads.asked, [FollowUpBucket.overdue]);
    await cubit.close();
  });

  testWidgets('the home shows the target, figures, attention, follow-ups, agenda and pipeline', (t) async {
    final cubit = SalesHomeCubit(_Repo(_home()), _Leads(), userId: 'u1');
    addTearDown(cubit.close);
    await _pump(t, cubit);

    expect(find.text('محمود'), findsNothing); // the name is split in two colours
    expect(find.textContaining('البنا'), findsOneWidget);
    expect(find.text('شركة ديمو'), findsOneWidget);
    expect(find.textContaining('54%'), findsOneWidget);
    expect(find.textContaining('4.32'), findsWidgets);
    expect(find.byKey(const Key('sales-home-fig-open-leads')), findsOneWidget);
    expect(find.text('2 بلا متابعة'), findsOneWidget);
    expect(find.byKey(const Key('sales-home-att-stale')), findsOneWidget);
    expect(find.text('أمل شاكر'), findsOneWidget);
    expect(find.text('عادل السيد'), findsOneWidget);
    expect(find.byKey(const Key('sales-home-stage-NEGOTIATION')), findsOneWidget);
    expect(find.byKey(const Key('sales-home-add-lead')), findsOneWidget);
  });

  testWidgets('a day without appointments says so', (t) async {
    final cubit = SalesHomeCubit(_Repo(_home(visits: const [])), _Leads(), userId: 'u1');
    addTearDown(cubit.close);
    await _pump(t, cubit);
    expect(find.text('لا توجد مواعيد في هذا اليوم.'), findsOneWidget);
  });
}
