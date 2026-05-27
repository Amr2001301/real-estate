import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/deposits/data/datasources/deposits_remote_data_source.dart';
import 'package:mobile_customer/features/deposits/data/dtos/deposit_dto.dart';
import 'package:mobile_customer/features/deposits/data/mappers/deposit_mapper.dart';
import 'package:mobile_customer/features/deposits/data/repositories/deposits_repository_impl.dart';
import 'package:mobile_customer/features/deposits/domain/entities/deposit.dart';
import 'package:mobile_customer/features/deposits/domain/repositories/deposits_repository.dart';
import 'package:mobile_customer/features/deposits/domain/usecases/get_my_deposits.dart';
import 'package:mobile_customer/features/deposits/presentation/deposits_cubit.dart';

class _FakeDataSource implements DepositsRemoteDataSource {
  _FakeDataSource({this.rows = const [], this.error});
  final List<DepositDto> rows;
  final DioException? error;

  @override
  Future<List<DepositDto>> listDeposits() async {
    if (error != null) throw error!;
    return rows;
  }
}

class _FakeRepo implements DepositsRepository {
  _FakeRepo(this._result);
  final Result<List<Deposit>> _result;
  @override
  Future<Result<List<Deposit>>> getMyDeposits() async => _result;
}

Map<String, dynamic> _json({bool verified = false, String type = 'BOOKING_AMOUNT'}) => {
      'id': 'd1',
      'amount': '15000.00',
      'type': type,
      'verified': verified,
      'paidAt': '2026-03-01T00:00:00.000Z',
      'contract': {
        'contractNumber': 'CT-1',
        'unit': {'code': 'A-1'},
      },
    };

void main() {
  group('DepositDto → entity', () {
    test('maps amount/type/verified/paidAt + contract info', () {
      final d = DepositDto.fromJson(_json(verified: true, type: 'INSTALLMENT')).toEntity();
      expect(d.amount, '15000.00');
      expect(d.type, DepositType.installment);
      expect(d.verified, isTrue);
      expect(d.paidAt, isNotNull);
      expect(d.contractNumber, 'CT-1');
      expect(d.unitCode, 'A-1');
    });

    test('unknown type falls back to unknown', () {
      final d = DepositDto.fromJson(_json(type: 'WEIRD')).toEntity();
      expect(d.type, DepositType.unknown);
      expect(d.verified, isFalse);
    });
  });

  group('DepositsRepositoryImpl error mapping', () {
    test('500 → Err(server, retryable)', () async {
      final repo = DepositsRepositoryImpl(_FakeDataSource(
        error: DioException(
          requestOptions: RequestOptions(path: '/me/deposits'),
          type: DioExceptionType.badResponse,
          response: Response(
            requestOptions: RequestOptions(path: '/me/deposits'),
            statusCode: 500,
          ),
        ),
      ));
      final result = await repo.getMyDeposits();
      expect(result.failureOrNull?.type, FailureType.server);
      expect(result.failureOrNull?.isRetryable, isTrue);
    });

    test('success maps rows', () async {
      final repo = DepositsRepositoryImpl(_FakeDataSource(
        rows: [DepositDto.fromJson(_json(verified: true))],
      ));
      final result = await repo.getMyDeposits();
      expect(result.dataOrNull, hasLength(1));
      expect(result.dataOrNull?.single.verified, isTrue);
    });
  });

  group('DepositsCubit', () {
    test('empty → empty state', () async {
      final cubit = DepositsCubit(GetMyDeposits(_FakeRepo(const Ok([]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('failure → failure state', () async {
      final cubit = DepositsCubit(GetMyDeposits(
        _FakeRepo(Result.err(AppFailure(type: FailureType.network))),
      ));
      await cubit.load();
      expect(cubit.state.status, DataStatus.failure);
    });
  });
}
