import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/dashboard/data/datasources/dashboard_remote_data_source.dart';
import 'package:mobile_staff/features/dashboard/data/repositories/dashboard_repository_impl.dart';
import 'package:mobile_staff/features/dashboard/domain/entities/sales_dashboard.dart';
import 'package:mobile_staff/features/dashboard/domain/repositories/dashboard_repository.dart';
import 'package:mobile_staff/features/dashboard/domain/usecases/get_sales_dashboard.dart';
import 'package:mobile_staff/features/dashboard/presentation/cubit/dashboard_cubit.dart';

class _FakeDataSource implements DashboardRemoteDataSource {
  _FakeDataSource({this.pipelineError, this.visitsThrows = false});

  final pipeline = const {'NEW': 2, 'WON': 1};
  final visits = const {'todayVisits': 3, 'scheduledVisits': 5};
  final reservations = const {'total': 4};
  final DioException? pipelineError;
  final bool visitsThrows;

  @override
  Future<Map<String, int>> pipelineCounts() async {
    if (pipelineError != null) throw pipelineError!;
    return pipeline;
  }

  @override
  Future<Map<String, dynamic>> visitStats() async {
    if (visitsThrows) throw DioException(requestOptions: RequestOptions(path: '/visits/stats'));
    return visits;
  }

  @override
  Future<Map<String, dynamic>> reservationStats() async => reservations;
}

class _FakeRepo implements DashboardRepository {
  _FakeRepo(this._result);
  final Result<SalesDashboard> _result;
  @override
  Future<Result<SalesDashboard>> getDashboard() async => _result;
}

void main() {
  group('DashboardRepositoryImpl', () {
    test('composes pipeline + visits + reservations', () async {
      final repo = DashboardRepositoryImpl(_FakeDataSource());
      final result = await repo.getDashboard();
      final d = result.dataOrNull!;
      expect(d.totalLeads, 3); // 2 + 1
      expect(d.wonLeads, 1);
      expect(d.todayVisits, 3);
      expect(d.scheduledVisits, 5);
      expect(d.reservations, 4);
    });

    test('best-effort: a failing visit-stats call falls back to 0, not error', () async {
      final repo = DashboardRepositoryImpl(_FakeDataSource(visitsThrows: true));
      final result = await repo.getDashboard();
      expect(result.isOk, isTrue);
      expect(result.dataOrNull?.todayVisits, 0);
    });

    test('a failing pipeline (required) maps to Err', () async {
      final repo = DashboardRepositoryImpl(_FakeDataSource(
        pipelineError: DioException(
          requestOptions: RequestOptions(path: '/leads/pipeline'),
          type: DioExceptionType.badResponse,
          response: Response(
            requestOptions: RequestOptions(path: '/leads/pipeline'),
            statusCode: 403,
          ),
        ),
      ));
      final result = await repo.getDashboard();
      expect(result.failureOrNull?.type, FailureType.forbidden);
    });
  });

  group('DashboardCubit', () {
    test('success emits data', () async {
      const dashboard = SalesDashboard(
        pipeline: {'NEW': 1},
        totalLeads: 1,
        wonLeads: 0,
        todayVisits: 0,
        scheduledVisits: 0,
        reservations: 0,
      );
      final cubit = DashboardCubit(GetSalesDashboard(_FakeRepo(const Ok(dashboard))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.data?.totalLeads, 1);
    });

    test('failure emits failure', () async {
      final cubit = DashboardCubit(GetSalesDashboard(
        _FakeRepo(Result.err(AppFailure(type: FailureType.server))),
      ));
      await cubit.load();
      expect(cubit.state.status, DataStatus.failure);
    });
  });
}
