import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/leads/data/dtos/lead_dtos.dart';
import 'package:mobile_staff/features/leads/data/mappers/lead_mapper.dart';
import 'package:mobile_staff/features/leads/data/repositories/leads_repository_impl.dart';
import 'package:mobile_staff/features/leads/data/datasources/leads_remote_data_source.dart';
import 'package:mobile_staff/features/leads/domain/entities/lead.dart';
import 'package:mobile_staff/features/leads/domain/repositories/leads_repository.dart';
import 'package:mobile_staff/features/leads/domain/usecases/lead_use_cases.dart';
import 'package:mobile_staff/features/leads/presentation/cubit/lead_detail_cubit.dart';
import 'package:mobile_staff/features/leads/presentation/cubit/leads_cubit.dart';
import 'package:mobile_staff/features/leads/presentation/screens/lost_reason_sheet.dart';

class _FakeRemote implements LeadsRemoteDataSource {
  _FakeRemote({this.rows = const [], this.error});
  final List<LeadRowDto> rows;
  final DioException? error;

  @override
  Future<Paginated<LeadRowDto>> list(LeadsQuery query) async {
    if (error != null) throw error!;
    final meta = PageMeta(page: 1, pageSize: 20, total: rows.length, totalPages: 1);
    return Paginated(data: rows, meta: meta);
  }

  @override
  Future<LeadDetailDto> getOne(String id) async => throw UnimplementedError();
  @override
  Future<void> updateStage(String id, String stage, String? reason, {String? lostReasonId, String? lostNote}) async {}
  @override
  Future<List<LostReasonDto>> listLostReasons() async => const [];
  @override
  Future<void> addNote(String id, String body) async {}
  @override
  Future<LeadRowDto> create(NewLead input) async => throw UnimplementedError();
  @override
  Future<List<LeadSourceDto>> listSources() async => const [];
  @override
  Future<List<ClientSearchDto>> searchClients(String q) async => const [];
}

class _FakeRepo implements LeadsRepository {
  _FakeRepo(this._leads, {this.reasons = const []});
  final Result<List<Lead>> _leads;
  final List<LostReason> reasons;
  final stageCalls = <String>[];

  @override
  Future<Result<Paginated<Lead>>> getLeads(LeadsQuery query) async => _leads.when(
        ok: (list) {
          final meta = PageMeta(page: 1, pageSize: 20, total: list.length, totalPages: 1);
          return Ok(Paginated(data: list, meta: meta));
        },
        err: Err.new,
      );

  @override
  Future<Result<LeadDetail>> getLead(String id) async =>
      const Ok(LeadDetail(lead: Lead(id: 'l1', fullName: 'Mona', stage: 'NEW'), timeline: []));
  @override
  Future<Result<void>> updateStage(String id, String stage, {String? reason, String? lostReasonId, String? lostNote}) async {
    stageCalls.add('$id:$stage:$lostReasonId:$lostNote');
    return const Ok(null);
  }
  @override
  Future<Result<List<LostReason>>> getLostReasons() async => Ok(reasons);
  @override
  Future<Result<void>> addNote(String id, String body) async => const Ok(null);
  @override
  Future<Result<Lead>> createLead(NewLead input) async => throw UnimplementedError();
  @override
  Future<Result<List<LeadSource>>> getSources() async => const Ok([]);
  @override
  Future<Result<List<ClientSearchResult>>> searchClients(String q) async => const Ok([]);
}

Map<String, dynamic> _row({String stage = 'NEW'}) => {
      'id': 'l1',
      'stage': stage,
      'createdAt': '2026-05-01T00:00:00.000Z',
      'client': {'id': 'c1', 'fullName': 'Mona', 'phone': '+201', 'email': 'm@x.com'},
      'assignedSales': {'fullName': 'Rep'},
      'projectInterest': {'name': {'ar': 'مشروع', 'en': 'Project'}},
    };

void main() {
  group('LeadRowDto → entity', () {
    test('prefers client contact + maps stage/project', () {
      final lead = LeadRowDto.fromJson(_row(stage: 'NEGOTIATION')).toEntity();
      expect(lead.fullName, 'Mona');
      expect(lead.phone, '+201');
      expect(lead.stage, 'NEGOTIATION');
      expect(lead.projectInterest, 'Project');
      expect(lead.assignedSalesName, 'Rep');
    });
  });

  group('LeadDetailDto → entity timeline', () {
    test('merges notes + activities, newest first', () {
      final detail = LeadDetailDto.fromJson({
        ..._row(),
        'unitInterest': {'code': 'A-1'},
        'notes': [
          {'id': 'n1', 'body': 'Called client', 'createdAt': '2026-05-02T00:00:00.000Z', 'sales': {'fullName': 'Rep'}},
        ],
        'activities': [
          {'id': 'a1', 'type': 'status_change', 'createdAt': '2026-05-03T00:00:00.000Z'},
        ],
      }).toEntity();
      expect(detail.unitInterest, 'A-1');
      expect(detail.timeline.first.id, 'a1'); // newest
      expect(detail.timeline.first.isNote, isFalse);
      expect(detail.timeline.last.isNote, isTrue);
    });
  });

  group('LeadsRepositoryImpl error mapping', () {
    test('403 → Err(forbidden)', () async {
      final repo = LeadsRepositoryImpl(_FakeRemote(
        error: DioException(
          requestOptions: RequestOptions(path: '/leads'),
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: RequestOptions(path: '/leads'), statusCode: 403),
        ),
      ));
      final result = await repo.getLeads(const LeadsQuery());
      expect(result.failureOrNull?.type, FailureType.forbidden);
    });

    test('success maps rows', () async {
      final repo = LeadsRepositoryImpl(_FakeRemote(rows: [LeadRowDto.fromJson(_row())]));
      final result = await repo.getLeads(const LeadsQuery());
      expect(result.dataOrNull?.data, hasLength(1));
    });
  });

  group('LeadsCubit', () {
    Lead lead(String stage) => Lead(id: 'l1', fullName: 'Mona', stage: stage);

    test('empty → empty state', () async {
      final repo = _FakeRepo(const Ok([]));
      final cubit = LeadsCubit(GetLeads(repo), repo);
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('setStage updates filter and reloads', () async {
      final repo = _FakeRepo(Ok([lead('WON')]));
      final cubit = LeadsCubit(GetLeads(repo), repo);
      await cubit.setStage('WON');
      expect(cubit.state.stage, 'WON');
      expect(cubit.state.status, DataStatus.success);
    });

    test('toggleMine flips the mine flag', () async {
      final repo = _FakeRepo(Ok([lead('NEW')]));
      final cubit = LeadsCubit(GetLeads(repo), repo);
      await cubit.toggleMine();
      expect(cubit.state.mine, isTrue);
    });
  });

  group('Lost reasons (LR1)', () {
    test('the lead detail carries why it was lost', () {
      final detail = LeadDetailDto.fromJson({
        ..._row(stage: 'LOST'),
        'lostReason': {'id': 'r1', 'name': {'ar': 'السعر عالي', 'en': 'Price too high'}},
        'lostNote': 'لقى أرخص',
      }).toEntity();
      expect(detail.lostReason?.resolve('ar'), 'السعر عالي');
      expect(detail.lostReason?.resolve('en'), 'Price too high');
      expect(detail.lostNote, 'لقى أرخص');
      // A flattened name (Accept-Language) reads the same.
      final flat = LostReasonDto.fromJson({'id': 'r1', 'name': 'Price too high'});
      expect(flat.name.resolve('ar'), 'Price too high');
    });

    test('marking lost sends the reason and the note', () async {
      final repo = _FakeRepo(const Ok([]));
      final cubit = LeadDetailCubit(
        GetLeadDetail(repo),
        UpdateLeadStage(repo),
        AddLeadNote(repo),
        leadId: 'l1',
        getLostReasons: GetLostReasons(repo),
      );
      await cubit.markLost('r1', note: 'لقى أرخص');
      expect(repo.stageCalls, ['l1:LOST:r1:لقى أرخص']);
    });

    Widget host(LeadDetailCubit cubit) => MaterialApp(
          theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
          locale: const Locale('ar'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: SingleChildScrollView(child: LostReasonSheet(cubit: cubit))),
        );

    testWidgets('the sheet needs a reason before it confirms', (tester) async {
      const reasons = [
        LostReason(id: 'r1', name: Translatable(ar: 'السعر عالي', en: 'Price too high')),
        LostReason(id: 'r2', name: Translatable(ar: 'اشترى من منافس', en: 'Bought elsewhere')),
      ];
      final repo = _FakeRepo(const Ok([]), reasons: reasons);
      final cubit = LeadDetailCubit(
        GetLeadDetail(repo),
        UpdateLeadStage(repo),
        AddLeadNote(repo),
        leadId: 'l1',
        getLostReasons: GetLostReasons(repo),
      );
      await tester.pumpWidget(host(cubit));
      await tester.pumpAndSettle();
      expect(find.text('السعر عالي'), findsOneWidget);
      expect(find.text('اشترى من منافس'), findsOneWidget);
      await tester.tap(find.byKey(const Key('lost-confirm')));
      await tester.pump();
      expect(repo.stageCalls, isEmpty);
      await tester.tap(find.text('اشترى من منافس'));
      await tester.pump();
      await tester.tap(find.byKey(const Key('lost-confirm')));
      await tester.pumpAndSettle();
      expect(repo.stageCalls, ['l1:LOST:r2:']);
    });

    testWidgets('no reasons yet: says so and cannot confirm', (tester) async {
      final repo = _FakeRepo(const Ok([]));
      final cubit = LeadDetailCubit(
        GetLeadDetail(repo),
        UpdateLeadStage(repo),
        AddLeadNote(repo),
        leadId: 'l1',
        getLostReasons: GetLostReasons(repo),
      );
      await tester.pumpWidget(host(cubit));
      await tester.pumpAndSettle();
      expect(find.textContaining('مفيش أسباب خسارة'), findsOneWidget);
      await tester.tap(find.byKey(const Key('lost-confirm')));
      await tester.pump();
      expect(repo.stageCalls, isEmpty);
    });
  });
}
