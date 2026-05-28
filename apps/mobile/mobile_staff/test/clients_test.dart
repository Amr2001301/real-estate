import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/clients/data/datasources/clients_remote_data_source.dart';
import 'package:mobile_staff/features/clients/data/dtos/client_lead_dto.dart';
import 'package:mobile_staff/features/clients/data/mappers/client_mapper.dart';
import 'package:mobile_staff/features/clients/data/repositories/clients_repository_impl.dart';
import 'package:mobile_staff/features/clients/domain/entities/staff_client.dart';
import 'package:mobile_staff/features/clients/domain/repositories/clients_repository.dart';
import 'package:mobile_staff/features/clients/domain/usecases/client_use_cases.dart';
import 'package:mobile_staff/features/clients/presentation/cubit/clients_cubit.dart';

class _FakeRemote implements ClientsRemoteDataSource {
  _FakeRemote({this.rows = const [], this.error});
  final List<ClientLeadDto> rows;
  final DioException? error;

  @override
  Future<List<ClientLeadDto>> listLeads({String? search}) async {
    if (error != null) throw error!;
    return rows;
  }

  @override
  Future<List<ClientLeadDto>> listLeadsForClient(String clientId) async =>
      rows.where((r) => r.clientId == clientId).toList();
}

class _FakeRepo implements ClientsRepository {
  _FakeRepo(this._clients);
  final Result<List<StaffClient>> _clients;
  @override
  Future<Result<List<StaffClient>>> getMyClients({String? search}) async => _clients;
  @override
  Future<Result<ClientDetail>> getClient(String clientId) async => throw UnimplementedError();
}

ClientLeadDto _row(String clientId, String name, {String stage = 'NEW', String? date}) =>
    ClientLeadDto.fromJson({
      'id': 'lead-$clientId-$stage',
      'stage': stage,
      'createdAt': date,
      'client': {'id': clientId, 'fullName': name, 'phone': '+20$clientId'},
    });

void main() {
  group('clientsFromLeadRows (dedup)', () {
    test('collapses leads by clientId; newest stage wins; counts leads', () {
      final clients = clientsFromLeadRows([
        _row('c1', 'Mona', stage: 'NEW', date: '2026-05-01T00:00:00.000Z'),
        _row('c1', 'Mona', stage: 'WON', date: '2026-05-05T00:00:00.000Z'),
        _row('c2', 'Ali', stage: 'INTERESTED', date: '2026-05-02T00:00:00.000Z'),
      ]);
      expect(clients, hasLength(2));
      final mona = clients.firstWhere((c) => c.clientId == 'c1');
      expect(mona.leadCount, 2);
      expect(mona.latestStage, 'WON'); // newest
    });
  });

  group('clientDetailFromRows', () {
    test('builds client + lead refs', () {
      final detail = clientDetailFromRows('c1', [
        _row('c1', 'Mona', stage: 'NEW', date: '2026-05-01T00:00:00.000Z'),
        _row('c1', 'Mona', stage: 'VISIT', date: '2026-05-03T00:00:00.000Z'),
      ]);
      expect(detail.client.fullName, 'Mona');
      expect(detail.client.leadCount, 2);
      expect(detail.leads.first.stage, 'VISIT'); // newest first
    });
  });

  group('ClientsRepositoryImpl', () {
    test('500 → Err(server)', () async {
      final repo = ClientsRepositoryImpl(_FakeRemote(
        error: DioException(
          requestOptions: RequestOptions(path: '/leads'),
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: RequestOptions(path: '/leads'), statusCode: 500),
        ),
      ));
      final result = await repo.getMyClients();
      expect(result.failureOrNull?.type, FailureType.server);
    });

    test('success dedups into clients', () async {
      final repo = ClientsRepositoryImpl(_FakeRemote(rows: [
        _row('c1', 'Mona'),
        _row('c1', 'Mona', stage: 'WON'),
      ]));
      final result = await repo.getMyClients();
      expect(result.dataOrNull, hasLength(1));
    });
  });

  group('ClientsCubit', () {
    test('empty → empty state', () async {
      final cubit = ClientsCubit(GetMyClients(_FakeRepo(const Ok([]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('success → data state', () async {
      final cubit = ClientsCubit(GetMyClients(_FakeRepo(const Ok([
        StaffClient(clientId: 'c1', fullName: 'Mona', leadCount: 1, latestStage: 'NEW'),
      ]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.clients, hasLength(1));
    });
  });
}
