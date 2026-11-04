import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/dashboard/manager_home/manager_home_screen.dart';
import 'package:mobile_staff/features/dashboard/sales_home/sales_home_cubit.dart';
import 'package:mobile_staff/features/dashboard/sales_home/sales_home_data.dart';
import 'package:mobile_staff/features/leads/domain/entities/lead.dart';
import 'package:mobile_staff/features/leads/domain/repositories/leads_repository.dart';
import 'package:mobile_staff/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:mobile_staff/features/notifications/domain/usecases/notification_use_cases.dart';
import 'package:mobile_staff/features/notifications/presentation/cubit/unread_count_cubit.dart';

/// Screen 77 — the sales manager's home: the team's target, decisions, the
/// team ranking and the team's week.

final _now = DateTime.now();

TeamRow _rep(String id, String name, double realized, int pct, {bool active = true}) => TeamRow(
      salesId: id,
      name: name,
      active: active,
      performance: SalesPerformanceRow(
        achievedAmount: realized,
        achievedUnits: 1,
        signedContracts: 1,
        realizedValue: realized,
        targetAmount: realized * 100 / pct,
        targetUnits: 2,
        targetPercent: pct,
      ),
    );

SalesHome _home() => SalesHome(
      openLeads: 35,
      staleLeads: 9,
      stages: const {'NEW': 13, 'INTERESTED': 6, 'VISIT': 6, 'NEGOTIATION': 10},
      activeReservations: 4,
      expiring: const [],
      visits: [
        AgendaEvent(
          kind: AgendaKind.visit,
          id: 'v1',
          at: DateTime(_now.year, _now.month, _now.day, 12),
          title: 'عادل السيد',
          who: 'محمود البنا',
        ),
      ],
      unconfirmedVisits: 6,
      pendingReservations: 2,
      performance: const SalesPerformanceRow(
        achievedAmount: 19840000,
        achievedUnits: 4,
        signedContracts: 4,
        realizedValue: 19840000,
        targetAmount: 45000000,
        targetPercent: 44,
      ),
      team: [
        _rep('r1', 'عمر الشناوي', 5920000, 49),
        _rep('r2', 'محمود البنا', 4320000, 54),
        _rep('r3', 'سامي خالد', 0, 1, active: false),
      ],
    );

class _Repo implements SalesHomeRepository {
  bool? askedTeam;
  @override
  Future<Result<SalesHome>> load({required String userId, DateTime? now, bool team = false}) async {
    askedTeam = team;
    return Ok(_home());
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _Leads implements LeadsRepository {
  @override
  Future<Result<FollowUpSummary>> getFollowUpSummary() async => const Ok(FollowUpSummary());
  @override
  Future<Result<Paginated<FollowUp>>> getFollowUps(FollowUpBucket bucket, {int page = 1}) async =>
      Ok(Paginated(data: const [], meta: PageMeta(page: 1, pageSize: 20, total: 0, totalPages: 1)));
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
  test("a rep with no activity this month isn't active (the website's rule)", () {
    final row = TeamRow.fromJson(const {
      'salesId': 'x',
      'salesName': 'ر',
      'leadsCount': 0,
      'visitsCount': 0,
      'reservationsCount': 0,
      'signedContractsCount': 0,
      'achievedAmount': 0,
      'realizedValue': 0,
    });
    expect(row.active, isFalse);
  });

  testWidgets('the manager sees the team target, decisions, ranking and team agenda', (t) async {
    t.view.physicalSize = const Size(390 * 3, 3200 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final repo = _Repo();
    final cubit = SalesHomeCubit(repo, _Leads(), userId: 'm1', team: true);
    addTearDown(cubit.close);
    final session = SessionCubit(TokenStorage())
      ..adopt(const Session(userId: 'm1', role: AppRole.salesManager, displayName: 'هالة عبد الرحمن'));
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
        home: const ManagerHomeScreen(),
      ),
    ));
    await t.pumpAndSettle();

    expect(repo.askedTeam, isTrue);
    expect(find.text('هدف الفريق هذا الشهر'), findsOneWidget);
    expect(find.textContaining('44%'), findsOneWidget);
    expect(find.byKey(const Key('home-att-pending')), findsOneWidget);
    expect(find.byKey(const Key('home-att-inactive')), findsOneWidget);
    expect(find.text('عمر الشناوي'), findsOneWidget);
    expect(find.byKey(const Key('home-rank-r1')), findsOneWidget);
    expect(find.text('مع محمود البنا'), findsOneWidget);
    expect(find.text('أجندة الفريق'), findsOneWidget);
    expect(find.byKey(const Key('home-action-targets')), findsOneWidget);
  });
}
