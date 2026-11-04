import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/broker/catalog/domain/entities/broker_project.dart';
import 'package:mobile_staff/features/broker/home/broker_home_data.dart';
import 'package:mobile_staff/features/broker/home/broker_home_screen.dart';
import 'package:mobile_staff/features/broker/profile/domain/entities/broker_profile.dart';
import 'package:mobile_staff/features/broker/profile/domain/repositories/broker_profile_repository.dart';
import 'package:mobile_staff/features/broker/profile/domain/usecases/get_broker_profile.dart';
import 'package:mobile_staff/features/broker/profile/presentation/cubit/broker_profile_cubit.dart';
import 'package:mobile_staff/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:mobile_staff/features/notifications/domain/usecases/notification_use_cases.dart';
import 'package:mobile_staff/features/notifications/presentation/cubit/unread_count_cubit.dart';

/// The broker's home: the broker portal's figures, as on the website.

final _today = DateTime.now().toUtc().toIso8601String();

BrokerHome _home() => BrokerHome.fromJson(
      performance: const {
        'summary': {
          'leadsSubmitted': 5,
          'leadsApproved': 3,
          'leadsRejected': 1,
          'leadsDuplicate': 0,
          'reservationsCreated': 3,
          'contractsSigned': 3,
          'payoutsPaid': 1,
          'salesGross': '15840000',
          'commissionsNet': '396000',
          'commissionsPendingNet': '132000',
          'commissionsPending': 1,
          'payoutsTotalNet': '264000',
        },
      },
      units: {
        'data': [
          for (var i = 0; i < 8; i++) {'id': 'u$i', 'building': {'phase': {'projectId': 'p1'}}},
          for (var i = 0; i < 8; i++) {'id': 'v$i', 'building': {'phase': {'projectId': 'p2'}}},
        ],
        'meta': {'total': 16},
      },
      leads: {
        'data': [
          {'id': 'l1', 'fullName': 'عمرو عبد الله', 'brokerApprovalStatus': 'PENDING', 'createdAt': _today},
          {'id': 'l2', 'fullName': 'إسلام زكي', 'brokerApprovalStatus': 'REJECTED', 'createdAt': _today},
          {'id': 'l3', 'fullName': 'محمد الجمال', 'brokerApprovalStatus': 'APPROVED', 'createdAt': '2026-07-16T10:00:00Z'},
        ],
      },
      pendingReservations: const {'meta': {'total': 3}},
      activity: {
        'data': [
          {'type': 'PAYOUT_PAID', 'createdAt': _today, 'payload': {'reference': 'PAY-2026-0001', 'paymentMethod': 'BANK_TRANSFER'}},
          {'type': 'LEAD_SUBMITTED', 'createdAt': _today, 'lead': {'fullName': 'عمرو عبد الله'}, 'payload': <String, dynamic>{}},
        ],
      },
      projects: [
        BrokerProject(id: 'p1', name: Translatable.fromJson('لاجونا باي — الساحل الشمالي'), status: 'ACTIVE', city: 'الساحل الشمالي'),
        BrokerProject(id: 'p2', name: Translatable.fromJson('نايل جاردنز ريزيدنس'), status: 'ACTIVE', city: 'القاهرة الجديدة'),
      ],
    );

class _Repo implements BrokerHomeRepository {
  @override
  Future<Result<BrokerHome>> load() async => Ok(_home());
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _Profile implements BrokerProfileRepository {
  _Profile(this.commissions);
  final bool commissions;
  @override
  Future<Result<BrokerProfile>> getProfile() async => Ok(BrokerProfile(
        canViewCommissions: commissions,
        isPrimaryContact: true,
        canManageBrokerUsers: true,
        fullName: 'كريم حلمي',
        companyName: 'بيت الخبرة للتسويق العقاري',
      ));
}

class _Notifs implements NotificationsRepository {
  @override
  Future<Result<int>> getUnreadCount() async => const Ok(0);
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Future<void> _pump(WidgetTester t, {required bool commissions}) async {
  t.view.physicalSize = const Size(390 * 3, 3600 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
  final home = BrokerHomeCubit(_Repo());
  addTearDown(home.close);
  final profile = BrokerProfileCubit(GetBrokerProfile(_Profile(commissions)));
  await profile.load();
  addTearDown(profile.close);
  final session = SessionCubit(TokenStorage())
    ..adopt(const Session(userId: 'b1', role: AppRole.broker, displayName: 'كريم حلمي'));
  addTearDown(session.close);
  await t.pumpWidget(MultiBlocProvider(
    providers: [
      BlocProvider.value(value: session),
      BlocProvider(create: (_) => UnreadCountCubit(GetUnreadCount(_Notifs()))),
      BlocProvider.value(value: home),
      BlocProvider.value(value: profile),
    ],
    child: MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const BrokerHomeScreen(),
    ),
  ));
  await t.pumpAndSettle();
}

void main() {
  test('reads the portal figures as the website does', () {
    final h = _home();
    expect(h.leadsPending, 1); // sent − approved − rejected − duplicate
    expect(h.approvalRate, 60);
    expect(h.contractRate, 100);
    expect(h.payoutRate, 33); // payouts paid over contracts signed
    expect(h.reservationsPending, 3);
    expect(h.availableUnits, 16);
    expect(h.projects.map((p) => p.$2), [8, 8]);
    expect(h.activity.first.reference, 'PAY-2026-0001');
  });

  testWidgets('the broker sees sales, performance, follow-ups, leads, projects and activity', (t) async {
    await _pump(t, commissions: true);
    expect(find.text('حجم مبيعاتك'), findsOneWidget);
    expect(find.textContaining('60%'), findsWidgets);
    expect(find.text('عمولاتك'), findsOneWidget);
    expect(find.byKey(const Key('home-action-commissions')), findsOneWidget);
    expect(find.text('أداؤك'), findsOneWidget);
    expect(find.byKey(const Key('home-att-leads-pending')), findsOneWidget);
    expect(find.byKey(const Key('broker-lead-l1')), findsOneWidget);
    expect(find.text('مرفوض'), findsOneWidget);
    expect(find.text('مسار أدائك'), findsOneWidget);
    expect(find.byKey(const Key('broker-project-p1')), findsOneWidget);
    expect(find.text('صُرفت دفعة العمولة'), findsOneWidget);
    expect(find.textContaining('تحويل بنكي'), findsOneWidget);
  });

  testWidgets('without commission access no commission figure shows', (t) async {
    await _pump(t, commissions: false);
    expect(find.text('عمولاتك'), findsNothing);
    expect(find.byKey(const Key('home-action-commissions')), findsNothing);
    expect(find.byKey(const Key('home-fig-pending-commission')), findsNothing);
    expect(find.text('نسبة الصرف'), findsNothing);
    expect(find.byKey(const Key('home-action-reservations')), findsOneWidget);
  });
}
