import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/leads/data/dtos/lead_dtos.dart';
import 'package:mobile_staff/features/leads/data/mappers/lead_mapper.dart';
import 'package:mobile_staff/features/leads/domain/entities/lead.dart';
import 'package:mobile_staff/features/leads/domain/repositories/leads_repository.dart';
import 'package:mobile_staff/features/leads/domain/usecases/lead_use_cases.dart';
import 'package:mobile_staff/features/leads/presentation/cubit/leads_cubit.dart';
import 'package:mobile_staff/features/leads/presentation/screens/leads_screen.dart';

/// The leads list: the website's stage counts and card data.

final _now = DateTime.now();

Lead _lead(String id, {DateTime? next, String stage = 'NEW', String? rep = 'محمود البنا'}) => Lead(
      id: id,
      fullName: 'طارق رزق',
      stage: stage,
      phone: '+201000000000',
      assignedSalesName: rep,
      nextActionAt: next,
      stageChangedAt: _now.subtract(const Duration(days: 3)),
      projectName: Translatable.fromJson('كمبوند الرياض الجديدة'),
      unitCode: 'A-101',
      sourceName: Translatable.fromJson('موقع الويب'),
    );

class _Repo implements LeadsRepository {
  _Repo(this.leads);
  final List<Lead> leads;
  final queries = <LeadsQuery>[];
  final contacts = <String>[];

  @override
  Future<Result<Paginated<Lead>>> getLeads(LeadsQuery query) async {
    queries.add(query);
    return Ok(Paginated(data: leads, meta: PageMeta(page: 1, pageSize: 20, total: leads.length, totalPages: 1)));
  }

  @override
  Future<Result<Map<String, int>>> getPipeline() async =>
      const Ok({'NEW': 13, 'INTERESTED': 6, 'VISIT': 6, 'NEGOTIATION': 10, 'WON': 23, 'LOST': 4});
  @override
  Future<Result<int>> countUnassigned() async => const Ok(8);
  @override
  Future<Result<FollowUpSummary>> getFollowUpSummary() async => const Ok(FollowUpSummary(overdue: 3));
  @override
  Future<Result<String>> openContact(String id, String kind) async {
    contacts.add('$id:$kind');
    return const Ok('');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Future<_Repo> _pump(WidgetTester t, AppRole role, List<Lead> leads) async {
  t.view.physicalSize = const Size(390 * 3, 1800 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
  final repo = _Repo(leads);
  final cubit = LeadsCubit(GetLeads(repo), repo);
  addTearDown(cubit.close);
  final session = SessionCubit(TokenStorage())..adopt(Session(userId: 'u1', role: role, displayName: 'م'));
  addTearDown(session.close);
  await t.pumpWidget(MultiBlocProvider(
    providers: [BlocProvider.value(value: session), BlocProvider.value(value: cubit)],
    child: MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const LeadsScreen(),
    ),
  ));
  await t.pumpAndSettle();
  return repo;
}

void main() {
  test('the row reads the website card fields', () {
    final l = LeadRowDto.fromJson({
      'id': 'l1',
      'fullName': 'طارق',
      'stage': 'VISIT',
      'projectInterest': {'name': {'ar': 'كمبوند', 'en': 'Compound'}},
      'unitInterest': {'code': 'A-101'},
      'source': {'name': 'موقع الويب'},
      'broker': {'companyName': 'بيت الخبرة', 'commercialName': null},
      'upcomingVisit': {'scheduledAt': '2026-11-07T08:00:00Z'},
      'stageChangedAt': '2026-11-01T08:00:00Z',
      'lastContactAt': '2026-10-29T08:00:00Z',
    }).toEntity();
    expect(l.projectName!.resolve('ar'), 'كمبوند');
    expect(l.unitCode, 'A-101');
    expect(l.brokerName, 'بيت الخبرة');
    expect(l.upcomingVisitAt, isNotNull);
    expect(l.unassigned, isTrue);
  });

  test('follow-up state: overdue, today, upcoming', () {
    final now = DateTime(2026, 11, 4, 12);
    expect(leadFollowState(DateTime(2026, 11, 4, 9), now), LeadFollowState.overdue);
    expect(leadFollowState(DateTime(2026, 11, 4, 18), now), LeadFollowState.today);
    expect(leadFollowState(DateTime(2026, 11, 5, 9), now), LeadFollowState.upcoming);
  });

  testWidgets('a rep sees the stage counts, the overdue follow-ups and the card', (t) async {
    final repo = await _pump(t, AppRole.sales, [_lead('l1', next: _now.subtract(const Duration(hours: 2)))]);
    expect(find.byKey(const Key('home-fig-total')), findsOneWidget);
    expect(find.textContaining('62'), findsWidgets); // the pipeline total, not the loaded page
    expect(find.byKey(const Key('home-fig-overdue')), findsOneWidget);
    expect(find.byKey(const Key('home-pill-unassigned')), findsNothing);
    expect(find.textContaining('متابعة متأخرة'), findsOneWidget);
    expect(find.textContaining('A-101'), findsOneWidget);
    expect(find.text('موقع الويب'), findsOneWidget);
    expect(find.text('محمود البنا'), findsNothing); // reps don't see whose it is

    await t.tap(find.byKey(const Key('lead-call-l1')));
    await t.pumpAndSettle();
    expect(repo.contacts, ['l1:CALL']); // logged on the lead, as on the website
  });

  testWidgets('a manager sees the unassigned queue and the rep on each card', (t) async {
    final repo = await _pump(t, AppRole.salesManager, [_lead('l1'), _lead('l2', rep: null)]);
    expect(find.byKey(const Key('home-fig-unassigned')), findsOneWidget);
    expect(find.text('محمود البنا'), findsOneWidget);
    expect(find.text('غير مُسنَد'), findsWidgets);

    await t.tap(find.byKey(const Key('home-pill-unassigned')));
    await t.pumpAndSettle();
    expect(repo.queries.last.unassigned, isTrue);
  });
}
