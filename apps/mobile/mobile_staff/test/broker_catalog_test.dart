import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/broker/catalog/data/dtos/broker_catalog_dtos.dart';
import 'package:mobile_staff/features/broker/catalog/data/mappers/broker_catalog_mapper.dart';
import 'package:mobile_staff/features/broker/catalog/data/datasources/broker_catalog_remote_data_source.dart';
import 'package:mobile_staff/features/broker/catalog/data/repositories/broker_catalog_repository_impl.dart';
import 'package:mobile_staff/features/broker/catalog/domain/entities/broker_project.dart';
import 'package:mobile_staff/features/broker/catalog/domain/repositories/broker_catalog_repository.dart';
import 'package:mobile_staff/features/broker/catalog/domain/usecases/broker_catalog_use_cases.dart';
import 'package:mobile_staff/features/broker/catalog/presentation/cubit/broker_projects_cubit.dart';
import 'package:mobile_staff/features/broker/catalog/presentation/cubit/broker_units_cubit.dart';

class _FakeRemote implements BrokerCatalogRemoteDataSource {
  _FakeRemote({this.projects = const [], this.units = const [], this.error});
  final List<BrokerProjectDto> projects;
  final List<BrokerUnitDto> units;
  final DioException? error;

  @override
  Future<List<BrokerProjectDto>> listProjects() async {
    if (error != null) throw error!;
    return projects;
  }

  @override
  Future<List<BrokerUnitDto>> listUnits({String? projectId}) async {
    if (error != null) throw error!;
    return units;
  }
}

class _FakeRepo implements BrokerCatalogRepository {
  _FakeRepo({this.projects, this.units});
  final Result<List<BrokerProject>>? projects;
  final Result<List<BrokerUnit>>? units;
  @override
  Future<Result<List<BrokerProject>>> getProjects() async => projects!;
  @override
  Future<Result<List<BrokerUnit>>> getUnits({String? projectId}) async => units!;
}

void main() {
  group('BrokerProjectDto → entity (grant shape)', () {
    test('reads project + access.commissionPct', () {
      final p = BrokerProjectDto.fromJson({
        'project': {
          'id': 'p1',
          'status': 'PUBLISHED',
          'name': {'ar': 'م', 'en': 'Project'},
          'city': 'Cairo',
          'media': [{'url': 'https://cdn/x.jpg'}],
        },
        'access': {'commissionPct': '2.5'},
      }).toEntity();
      expect(p.name.en, 'Project');
      expect(p.city, 'Cairo');
      expect(p.coverImageUrl, 'https://cdn/x.jpg');
      expect(p.commissionPct, '2.5');
    });
  });

  group('BrokerUnitDto → entity', () {
    test('maps unit fields', () {
      final u = BrokerUnitDto.fromJson({
        'id': 'u1', 'code': 'A-1', 'type': 'APARTMENT', 'price': '900000', 'status': 'AVAILABLE',
      }).toEntity();
      expect(u.code, 'A-1');
      expect(u.price, '900000');
      expect(u.status, 'AVAILABLE');
    });
  });

  group('BrokerCatalogRepositoryImpl error mapping', () {
    test('403 → forbidden', () async {
      final repo = BrokerCatalogRepositoryImpl(_FakeRemote(
        error: DioException(
          requestOptions: RequestOptions(path: '/portal/projects'),
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: 403),
        ),
      ));
      final r = await repo.getProjects();
      expect(r.failureOrNull?.type, FailureType.forbidden);
    });

    test('success maps projects + units rows', () async {
      final repo = BrokerCatalogRepositoryImpl(_FakeRemote(
        projects: [
          BrokerProjectDto.fromJson({'project': {'id': 'p1', 'status': 'PUBLISHED', 'name': {'en': 'P'}}}),
        ],
        units: [BrokerUnitDto.fromJson({'id': 'u1', 'code': 'A-1', 'status': 'AVAILABLE'})],
      ));
      expect((await repo.getProjects()).dataOrNull, hasLength(1));
      expect((await repo.getUnits(projectId: 'p1')).dataOrNull?.single.code, 'A-1');
    });
  });

  group('BrokerProjectsCubit / BrokerUnitsCubit', () {
    test('projects empty → empty', () async {
      final cubit = BrokerProjectsCubit(GetBrokerProjects(_FakeRepo(projects: const Ok([]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('units success → data', () async {
      final cubit = BrokerUnitsCubit(
        GetBrokerProjectUnits(_FakeRepo(units: const Ok([
          BrokerUnit(id: 'u1', code: 'A-1', status: 'AVAILABLE'),
        ]))),
        projectId: 'p1',
      );
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.data, hasLength(1));
    });
  });
}
