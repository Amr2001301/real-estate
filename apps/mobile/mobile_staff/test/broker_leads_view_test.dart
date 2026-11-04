import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/broker/leads/data/dtos/broker_lead_dtos.dart';
import 'package:mobile_staff/features/broker/leads/data/mappers/broker_lead_mapper.dart';
import 'package:mobile_staff/features/broker/leads/domain/entities/broker_lead.dart';
import 'package:mobile_staff/features/broker/leads/domain/repositories/broker_leads_repository.dart';
import 'package:mobile_staff/features/broker/leads/domain/usecases/broker_lead_use_cases.dart';
import 'package:mobile_staff/features/broker/leads/presentation/cubit/broker_lead_detail_cubit.dart';
import 'package:mobile_staff/features/broker/leads/presentation/cubit/broker_leads_cubit.dart';
import 'package:mobile_staff/features/broker/leads/presentation/screens/broker_lead_detail_screen.dart';
import 'package:mobile_staff/features/broker/leads/presentation/screens/broker_leads_screen.dart';

/// The broker's leads: the portal's figures and fields.

const _row = {
  'id': 'l1',
  'fullName': 'إسلام زكي',
  'stage': 'NEW',
  'brokerApprovalStatus': 'REJECTED',
  'brokerRejectionReason': 'العميل مسجّل لدى فريق المبيعات',
  'brokerSubmittedAt': '2026-11-01T10:00:00Z',
  'brokerRejectedAt': '2026-11-02T10:00:00Z',
  'phone': '+201000000050',
  'projectInterest': {'name': 'نايل كريست ريزيدنس', 'city': 'القاهرة'},
  'unitInterest': {'code': 'NC-201', 'type': 'APARTMENT'},
  'assignedSales': {'fullName': 'ياسمين فاروق'},
  'appointments': [
    {'id': 'v1', 'visitNumber': 'VA-2026-0009', 'scheduledAt': '2026-11-03T10:00:00Z', 'status': 'COMPLETED'},
  ],
};

class _Repo implements BrokerLeadsRepository {
  final queries = <BrokerLeadsQuery>[];
  @override
  Future<Result<List<BrokerLead>>> getLeads(BrokerLeadsQuery query) async {
    queries.add(query);
    return Ok([BrokerLeadDto.fromJson(_row).toEntity()]);
  }

  @override
  Future<Result<BrokerLeadCounts>> getCounts() async =>
      const Ok(BrokerLeadCounts(total: 5, pending: 1, approved: 3, rejected: 1));
  @override
  Future<Result<BrokerLeadDetail>> getLead(String id) async => Ok(BrokerLeadDetailDto.fromJson(_row).toEntity());
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Widget _app(Widget home, List<BlocProvider> providers) => MultiBlocProvider(
      providers: providers,
      child: MaterialApp(
        theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

void main() {
  test('the row reads the portal fields', () {
    final l = BrokerLeadDto.fromJson(_row).toEntity();
    expect(l.assignedSalesName, 'ياسمين فاروق');
    expect(l.unitCode, 'NC-201');
    expect(l.rejectionReason, contains('مسجّل'));
    expect(l.sentAt, isNotNull);
    expect(BrokerLeadDetailDto.fromJson(_row).toEntity().visits.single.number, 'VA-2026-0009');
  });

  testWidgets('the list shows the approval figures, filters and the card', (t) async {
    t.view.physicalSize = const Size(390 * 3, 1600 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final repo = _Repo();
    final cubit = BrokerLeadsCubit(GetBrokerLeads(repo), repo);
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const BrokerLeadsScreen(), [BlocProvider<BrokerLeadsCubit>.value(value: cubit)]));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('home-fig-pending')), findsOneWidget);
    expect(find.byKey(const Key('home-fig-rejected')), findsOneWidget);
    expect(find.textContaining('ياسمين فاروق'), findsOneWidget);
    expect(find.textContaining('NC-201'), findsOneWidget);
    await t.tap(find.byKey(const Key('home-pill-PENDING')));
    await t.pumpAndSettle();
    expect(repo.queries.last.approvalStatus, 'PENDING');
  });

  testWidgets('the detail shows the rejection, the track and the visits; no booking', (t) async {
    t.view.physicalSize = const Size(390 * 3, 2200 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final cubit = BrokerLeadDetailCubit(GetBrokerLeadDetail(_Repo()), leadId: 'l1');
    addTearDown(cubit.close);
    await t.pumpWidget(_app(const BrokerLeadDetailScreen(), [BlocProvider<BrokerLeadDetailCubit>.value(value: cubit)]));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('broker-lead-rejection')), findsOneWidget);
    expect(find.text('رفضته الشركة'), findsOneWidget);
    expect(find.byKey(const Key('broker-visit-v1')), findsOneWidget);
    expect(find.byKey(const Key('broker-lead-book')), findsNothing); // only approved leads are booked
  });
}
