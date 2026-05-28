import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/broker/commissions/data/dtos/broker_commission_dto.dart';
import 'package:mobile_staff/features/broker/commissions/data/mappers/broker_commission_mapper.dart';
import 'package:mobile_staff/features/broker/commissions/data/datasources/broker_commissions_remote_data_source.dart';
import 'package:mobile_staff/features/broker/commissions/data/repositories/broker_commissions_repository_impl.dart';
import 'package:mobile_staff/features/broker/commissions/domain/entities/broker_commission.dart';
import 'package:mobile_staff/features/broker/commissions/domain/repositories/broker_commissions_repository.dart';
import 'package:mobile_staff/features/broker/commissions/domain/usecases/get_broker_commissions.dart';
import 'package:mobile_staff/features/broker/commissions/presentation/cubit/broker_commissions_cubit.dart';

class _FakeRemote implements BrokerCommissionsRemoteDataSource {
  _FakeRemote({this.rows = const [], this.error});
  final List<BrokerCommissionDto> rows;
  final DioException? error;
  @override
  Future<List<BrokerCommissionDto>> list(BrokerCommissionsQuery query) async {
    if (error != null) throw error!;
    return rows;
  }
}

class _FakeRepo implements BrokerCommissionsRepository {
  _FakeRepo(this._result);
  final Result<List<BrokerCommission>> _result;
  @override
  Future<Result<List<BrokerCommission>>> getCommissions(BrokerCommissionsQuery q) async => _result;
}

BrokerCommission _c(String status, String net) =>
    BrokerCommission(id: 'c', status: status, netAmount: net);

DioException _http(int s) => DioException(
      requestOptions: RequestOptions(path: '/portal/commissions'),
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: s),
    );

void main() {
  group('BrokerCommissionDto → entity', () {
    test('maps status + amounts + project', () {
      final c = BrokerCommissionDto.fromJson({
        'id': 'c1', 'status': 'APPROVED', 'grossAmount': '1000', 'netAmount': '900',
        'project': {'name': {'en': 'Project'}},
      }).toEntity();
      expect(c.status, 'APPROVED');
      expect(c.netAmount, '900');
      expect(c.projectName, 'Project');
    });
  });

  group('brokerCommissionTotals', () {
    test('sums approved vs pending (net preferred)', () {
      final t = brokerCommissionTotals([
        _c('APPROVED', '1000'),
        _c('PENDING', '300'),
        _c('REJECTED', '500'),
      ]);
      expect(t.approved, 1000);
      expect(t.pending, 300);
    });
  });

  group('BrokerCommissionsRepositoryImpl (viewer-gated)', () {
    test('403 (no canViewCommissions) → forbidden, never throws', () async {
      final repo = BrokerCommissionsRepositoryImpl(_FakeRemote(error: _http(403)));
      final r = await repo.getCommissions(const BrokerCommissionsQuery());
      expect(r.isErr, isTrue);
      expect(r.failureOrNull?.type, FailureType.forbidden);
    });

    test('success maps rows', () async {
      final repo = BrokerCommissionsRepositoryImpl(_FakeRemote(rows: [
        BrokerCommissionDto.fromJson({'id': 'c1', 'status': 'PAID', 'netAmount': '1'}),
      ]));
      expect((await repo.getCommissions(const BrokerCommissionsQuery())).dataOrNull, hasLength(1));
    });
  });

  group('BrokerCommissionsCubit', () {
    test('forbidden → failure (friendly state)', () async {
      final cubit = BrokerCommissionsCubit(GetBrokerCommissions(
        _FakeRepo(Result.err(AppFailure(type: FailureType.forbidden))),
      ));
      await cubit.load();
      expect(cubit.state.status, DataStatus.failure);
      expect(cubit.state.failure?.type, FailureType.forbidden);
    });

    test('success computes totals', () async {
      final cubit = BrokerCommissionsCubit(GetBrokerCommissions(_FakeRepo(Ok([
        _c('APPROVED', '1000'),
        _c('PENDING', '250'),
      ]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.approvedTotal, 1000);
      expect(cubit.state.pendingTotal, 250);
    });
  });
}
