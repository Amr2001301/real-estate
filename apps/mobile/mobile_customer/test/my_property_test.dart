import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/my_property/data/datasources/my_property_remote_data_source.dart';
import 'package:mobile_customer/features/my_property/data/dtos/property_row_dto.dart';
import 'package:mobile_customer/features/my_property/data/mappers/property_mapper.dart';
import 'package:mobile_customer/features/my_property/data/repositories/my_property_repository_impl.dart';
import 'package:mobile_customer/features/my_property/domain/entities/property.dart';
import 'package:mobile_customer/features/my_property/domain/repositories/my_property_repository.dart';
import 'package:mobile_customer/features/my_property/domain/usecases/get_my_properties.dart';
import 'package:mobile_customer/features/my_property/presentation/my_property_cubit.dart';

class _FakeDataSource implements MyPropertyRemoteDataSource {
  _FakeDataSource({this.rows = const [], this.error});
  final List<PropertyRowDto> rows;
  final DioException? error;

  @override
  Future<List<PropertyRowDto>> listContracts() async {
    if (error != null) throw error!;
    return rows;
  }
}

class _FakeRepo implements MyPropertyRepository {
  _FakeRepo(this._result);
  final Result<List<Property>> _result;
  @override
  Future<Result<List<Property>>> getMyProperties() async => _result;
}

Map<String, dynamic> _contractJson({String? signedAt}) => {
  'id': 'c1',
  'contractNumber': 'CT-100',
  'signedAt': signedAt,
  'reservation': {'reservationNumber': 'R-9'},
  'installmentPlan': {'monthlyAmount': '5000', 'totalMonths': 24},
  'unit': {
    'id': 'u1',
    'code': 'A-101',
    'type': 'APARTMENT',
    'building': {
      'phase': {
        'project': {
          'id': 'p1',
          'name': {'ar': 'مشروع', 'en': 'Project'},
        },
      },
    },
  },
};

void main() {
  group('PropertyRowDto → entity', () {
    test('signed contract maps to owned with full details', () {
      final entity = PropertyRowDto.fromJson(
        _contractJson(signedAt: '2026-01-02T00:00:00.000Z'),
      ).toEntity();
      expect(entity.contractId, 'c1');
      expect(entity.unitCode, 'A-101');
      expect(entity.projectName.en, 'Project');
      expect(entity.status, PropertyStatus.owned);
      expect(entity.signedAt, isNotNull);
      expect(entity.reservationNumber, 'R-9');
      expect(entity.hasInstallmentPlan, isTrue);
      expect(entity.totalMonths, 24);
    });

    test('unsigned contract maps to pending', () {
      final entity = PropertyRowDto.fromJson(_contractJson()).toEntity();
      expect(entity.status, PropertyStatus.pending);
      expect(entity.signedAt, isNull);
    });
  });

  group('MyPropertyRemoteDataSourceImpl endpoint', () {
    // Regression guard: the impl previously GET'd `/me/contracts`, which 404s
    // (the real route is `/v1/contracts/me/contracts`), leaving My Property
    // permanently empty on mobile. Exercise the real impl with a Dio whose
    // interceptor captures the requested path.
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
      final ds = MyPropertyRemoteDataSourceImpl(dio);
      final rows = await ds.listContracts();
      expect(rows, isEmpty);
      expect(pathsSeen, ['/contracts/me/contracts']);
    });
  });

  group('MyPropertyRepositoryImpl error mapping', () {
    test('401 → Err(unauthorized), never throws', () async {
      final repo = MyPropertyRepositoryImpl(
        _FakeDataSource(
          error: DioException(
            requestOptions: RequestOptions(path: '/me/contracts'),
            type: DioExceptionType.badResponse,
            response: Response(
              requestOptions: RequestOptions(path: '/me/contracts'),
              statusCode: 401,
            ),
          ),
        ),
      );
      final result = await repo.getMyProperties();
      expect(result.isErr, isTrue);
      expect(result.failureOrNull?.type, FailureType.unauthorized);
    });

    test('success maps rows to entities', () async {
      final repo = MyPropertyRepositoryImpl(
        _FakeDataSource(
          rows: [
            PropertyRowDto.fromJson(
              _contractJson(signedAt: '2026-01-01T00:00:00.000Z'),
            ),
          ],
        ),
      );
      final result = await repo.getMyProperties();
      expect(result.dataOrNull, hasLength(1));
    });
  });

  group('MyPropertyCubit', () {
    test('empty result emits empty state', () async {
      final cubit = MyPropertyCubit(GetMyProperties(_FakeRepo(const Ok([]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('success emits data', () async {
      final property = Property(
        contractId: 'c1',
        unitId: 'u1',
        unitCode: 'A-101',
        unitType: 'APARTMENT',
        projectName: const Translatable(ar: 'م', en: 'P'),
        status: PropertyStatus.owned,
      );
      final cubit = MyPropertyCubit(GetMyProperties(_FakeRepo(Ok([property]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.data, hasLength(1));
    });

    test('failure emits failure state', () async {
      final cubit = MyPropertyCubit(
        GetMyProperties(
          _FakeRepo(Result.err(AppFailure(type: FailureType.server))),
        ),
      );
      await cubit.load();
      expect(cubit.state.status, DataStatus.failure);
    });
  });
}
