import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/contracts/data/datasources/contracts_remote_data_source.dart';
import 'package:mobile_customer/features/contracts/data/dtos/contract_dto.dart';
import 'package:mobile_customer/features/contracts/data/mappers/contract_mapper.dart';
import 'package:mobile_customer/features/contracts/data/repositories/contracts_repository_impl.dart';
import 'package:mobile_customer/features/contracts/domain/entities/contract.dart';
import 'package:mobile_customer/features/contracts/domain/repositories/contracts_repository.dart';
import 'package:mobile_customer/features/contracts/domain/usecases/get_my_contracts.dart';
import 'package:mobile_customer/features/contracts/presentation/contracts_cubit.dart';

class _FakeDataSource implements ContractsRemoteDataSource {
  _FakeDataSource({this.rows = const [], this.error});
  final List<ContractDto> rows;
  final DioException? error;

  @override
  Future<List<ContractDto>> listContracts() async {
    if (error != null) throw error!;
    return rows;
  }
}

class _FakeRepo implements ContractsRepository {
  _FakeRepo(this._result);
  final Result<List<Contract>> _result;
  @override
  Future<Result<List<Contract>>> getMyContracts() async => _result;
}

Map<String, dynamic> _json({String? signedAt}) => {
  'id': 'c1',
  'contractNumber': 'CT-1',
  'signedAt': signedAt,
  'unit': {
    'code': 'A-1',
    'type': 'VILLA',
    'building': {
      'phase': {
        'project': {
          'name': {'ar': 'فيلا', 'en': 'Villa Project'},
        },
      },
    },
  },
};

void main() {
  group('ContractDto → entity', () {
    test('signed maps to signed status', () {
      final c = ContractDto.fromJson(
        _json(signedAt: '2026-02-01T00:00:00.000Z'),
      ).toEntity();
      expect(c.status, ContractStatus.signed);
      expect(c.contractNumber, 'CT-1');
      expect(c.projectName.en, 'Villa Project');
      expect(c.signedAt, isNotNull);
    });

    test('unsigned maps to draft', () {
      final c = ContractDto.fromJson(_json()).toEntity();
      expect(c.status, ContractStatus.draft);
    });
  });

  group('ContractsRemoteDataSourceImpl endpoint', () {
    // Regression guard: the impl previously GET'd `/me/contracts` (404). The
    // real route is `/v1/contracts/me/contracts`.
    test('GETs /contracts/me/contracts (not the 404 /me/contracts)', () async {
      final dio = Dio();
      final pathsSeen = <String>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            pathsSeen.add(options.path);
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                statusCode: 200,
                data: const {'data': <dynamic>[]},
              ),
            );
          },
        ),
      );
      final ds = ContractsRemoteDataSourceImpl(dio);
      final rows = await ds.listContracts();
      expect(rows, isEmpty);
      expect(pathsSeen, ['/contracts/me/contracts']);
    });
  });

  group('ContractsRepositoryImpl error mapping', () {
    test('403 → Err(forbidden)', () async {
      final repo = ContractsRepositoryImpl(
        _FakeDataSource(
          error: DioException(
            requestOptions: RequestOptions(path: '/me/contracts'),
            type: DioExceptionType.badResponse,
            response: Response(
              requestOptions: RequestOptions(path: '/me/contracts'),
              statusCode: 403,
            ),
          ),
        ),
      );
      final result = await repo.getMyContracts();
      expect(result.failureOrNull?.type, FailureType.forbidden);
    });

    test('success maps rows to entities', () async {
      final repo = ContractsRepositoryImpl(
        _FakeDataSource(
          rows: [
            ContractDto.fromJson(_json(signedAt: '2026-02-01T00:00:00.000Z')),
          ],
        ),
      );
      final result = await repo.getMyContracts();
      expect(result.isOk, isTrue);
      expect(result.dataOrNull?.single.status, ContractStatus.signed);
    });
  });

  group('ContractsCubit', () {
    test('empty → empty state', () async {
      final cubit = ContractsCubit(GetMyContracts(_FakeRepo(const Ok([]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('success → data state', () async {
      final cubit = ContractsCubit(
        GetMyContracts(
          _FakeRepo(
            Ok([
              Contract(
                id: 'c1',
                unitCode: 'A-1',
                unitType: 'VILLA',
                projectName: const Translatable(ar: '', en: 'P'),
                status: ContractStatus.signed,
              ),
            ]),
          ),
        ),
      );
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
    });
  });
}
