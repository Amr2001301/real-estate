import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/leads/data/dtos/lead_dtos.dart';
import 'package:mobile_staff/features/leads/data/mappers/lead_mapper.dart';
import 'package:mobile_staff/features/leads/data/repositories/leads_repository_impl.dart';
import 'package:mobile_staff/features/leads/data/datasources/leads_remote_data_source.dart';
import 'package:mobile_staff/features/leads/domain/entities/lead.dart';
import 'package:mobile_staff/features/leads/domain/repositories/leads_repository.dart';
import 'package:mobile_staff/features/leads/domain/usecases/lead_use_cases.dart';
import 'package:mobile_staff/features/leads/presentation/cubit/leads_cubit.dart';

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
  Future<void> updateStage(String id, String stage, String? reason) async {}
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
  _FakeRepo(this._leads);
  final Result<List<Lead>> _leads;

  @override
  Future<Result<Paginated<Lead>>> getLeads(LeadsQuery query) async => _leads.when(
        ok: (list) {
          final meta = PageMeta(page: 1, pageSize: 20, total: list.length, totalPages: 1);
          return Ok(Paginated(data: list, meta: meta));
        },
        err: Err.new,
      );

  @override
  Future<Result<LeadDetail>> getLead(String id) async => throw UnimplementedError();
  @override
  Future<Result<void>> updateStage(String id, String stage, {String? reason}) async => const Ok(null);
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
}
