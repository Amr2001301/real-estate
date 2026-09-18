import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/performance/data/dtos/performance_dtos.dart';
import 'package:mobile_staff/features/performance/data/mappers/performance_mapper.dart';
import 'package:mobile_staff/features/performance/data/datasources/performance_remote_data_source.dart';
import 'package:mobile_staff/features/performance/data/repositories/performance_repository_impl.dart';
import 'package:mobile_staff/features/performance/domain/entities/sales_performance.dart';
import 'package:mobile_staff/features/performance/domain/repositories/performance_repository.dart';
import 'package:mobile_staff/features/performance/domain/usecases/performance_use_cases.dart';
import 'package:mobile_staff/features/performance/presentation/cubit/target_summary_cubit.dart';
import 'package:mobile_staff/features/performance/presentation/cubit/targets_cubit.dart';

class _FakeRemote implements PerformanceRemoteDataSource {
  _FakeRemote({this.targets = const [], this.error});
  final List<SalesTargetDto> targets;
  final DioException? error;

  @override
  Future<SalesPerformanceDto?> getPerformance({String? period}) async {
    if (error != null) throw error!;
    return null; // exercises the "no row → zeroed entity" path
  }

  @override
  Future<List<SalesTargetDto>> listTargets() async {
    if (error != null) throw error!;
    return targets;
  }

  @override
  Future<List<TeamPerformanceRowDto>> getTeamPerformance({String? period}) async => const [];
  @override
  Future<List<SalesActorDto>> listActors() async => const [];
  @override
  Future<void> upsertTarget({
    required String salesId,
    required String period,
    required String amountTarget,
    required int unitsTarget,
  }) async {}
}

class _FakeRepo implements PerformanceRepository {
  _FakeRepo({this.perf, this.targets = const [], this.perfFailure});
  final SalesPerformance? perf;
  final List<SalesTarget> targets;
  final AppFailure? perfFailure;

  @override
  Future<Result<SalesPerformance>> getPerformance({String? period}) async =>
      perfFailure != null ? Result.err(perfFailure!) : Result.ok(perf!);
  @override
  Future<Result<List<SalesTarget>>> getTargets() async => Result.ok(targets);
  @override
  Future<Result<List<TeamMemberPerformance>>> getTeamPerformance({String? period}) async => const Ok([]);
  @override
  Future<Result<List<SalesActor>>> listActors() async => const Ok([]);
  @override
  Future<Result<void>> upsertTarget({
    required String salesId,
    required String period,
    required String amountTarget,
    required int unitsTarget,
  }) async => const Ok(null);
}

Map<String, dynamic> _perfJson() => {
      'period': '2026-05',
      'leadsCount': 10,
      'openLeadsCount': 4,
      'visitsCount': 6,
      'upcomingVisitsCount': 2,
      'reservationsCount': 3,
      'activeReservationsCount': 1,
      'convertedReservationsCount': 2,
      'signedContractsCount': 2,
      'realizedValue': 500000,
      'achievedAmount': 500000,
      'achievedUnits': 2,
      'targetAmount': 1000000,
      'targetUnits': 4,
      'targetAmountPercent': 50,
      'targetUnitsPercent': 50,
    };

void main() {
  group('SalesPerformanceDto → entity', () {
    test('maps counts + target/achievement', () {
      final p = SalesPerformanceDto.fromJson(_perfJson()).toEntity();
      expect(p.leadsCount, 10);
      expect(p.openLeadsCount, 4);
      expect(p.targetAmount, 1000000);
      expect(p.achievedAmount, 500000);
      expect(p.targetAmountPercent, 50);
      expect(p.hasTarget, isTrue);
    });

    test('no-target row → hasTarget false', () {
      final json = _perfJson()
        ..['targetAmount'] = null
        ..['targetUnits'] = null
        ..['targetAmountPercent'] = null
        ..['targetUnitsPercent'] = null;
      final p = SalesPerformanceDto.fromJson(json).toEntity();
      expect(p.hasTarget, isFalse);
    });
  });

  group('PerformanceRepositoryImpl', () {
    test('null performance row → zeroed entity (graceful)', () async {
      final repo = PerformanceRepositoryImpl(_FakeRemote());
      final r = await repo.getPerformance();
      expect(r.isOk, isTrue);
      expect(r.dataOrNull?.leadsCount, 0);
      expect(r.dataOrNull?.hasTarget, isFalse);
    });

    test('403 → forbidden', () async {
      final repo = PerformanceRepositoryImpl(_FakeRemote(
        error: DioException(
          requestOptions: RequestOptions(path: '/sales-targets/performance'),
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: 403),
        ),
      ));
      final r = await repo.getPerformance();
      expect(r.failureOrNull?.type, FailureType.forbidden);
    });

    test('targets list maps', () async {
      final repo = PerformanceRepositoryImpl(_FakeRemote(targets: [
        const SalesTargetDto(id: 't1', salesId: 's1', salesName: 'Rep', period: '2026-05', amountTarget: '1000000', unitsTarget: 4),
      ]));
      final r = await repo.getTargets();
      expect(r.dataOrNull?.single.unitsTarget, 4);
    });
  });

  group('TargetsCubit', () {
    test('loads performance + targets on success', () async {
      final perf = SalesPerformanceDto.fromJson(_perfJson()).toEntity();
      final repo = _FakeRepo(perf: perf, targets: const [
        SalesTarget(id: 't1', salesId: 's1', salesName: 'Rep', period: '2026-05', amountTarget: '1000000', unitsTarget: 4),
      ]);
      final cubit = TargetsCubit(GetSalesPerformance(repo), GetSalesTargets(repo));
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.performance?.leadsCount, 10);
      expect(cubit.state.targets, hasLength(1));
    });

    test('performance failure → failure state', () async {
      final repo = _FakeRepo(perfFailure: AppFailure(type: FailureType.forbidden));
      final cubit = TargetsCubit(GetSalesPerformance(repo), GetSalesTargets(repo));
      await cubit.load();
      expect(cubit.state.status, DataStatus.failure);
    });
  });

  group('TargetSummaryCubit (permission-aware)', () {
    test('forbidden → unavailable', () async {
      final repo = _FakeRepo(perfFailure: AppFailure(type: FailureType.forbidden));
      final cubit = TargetSummaryCubit(GetSalesPerformance(repo));
      await cubit.load();
      expect(cubit.state.status, TargetSummaryStatus.unavailable);
    });

    test('success → ready', () async {
      final perf = SalesPerformanceDto.fromJson(_perfJson()).toEntity();
      final cubit = TargetSummaryCubit(GetSalesPerformance(_FakeRepo(perf: perf)));
      await cubit.load();
      expect(cubit.state.status, TargetSummaryStatus.ready);
      expect(cubit.state.performance?.targetAmountPercent, 50);
    });
  });
}
