import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/clients/data/datasources/clients_remote_data_source.dart';
import 'package:mobile_staff/features/clients/data/dtos/client_lead_dto.dart';
import 'package:mobile_staff/features/clients/data/mappers/client_mapper.dart';
import 'package:mobile_staff/features/clients/data/repositories/clients_repository_impl.dart';

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

}
