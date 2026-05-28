import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/broker/dashboard/data/dtos/broker_dashboard_dto.dart';
import 'package:mobile_staff/features/broker/dashboard/data/mappers/broker_dashboard_mapper.dart';
import 'package:mobile_staff/features/broker/dashboard/data/datasources/broker_dashboard_remote_data_source.dart';
import 'package:mobile_staff/features/broker/dashboard/data/repositories/broker_dashboard_repository_impl.dart';
import 'package:mobile_staff/features/broker/dashboard/domain/entities/broker_dashboard.dart';
import 'package:mobile_staff/features/broker/dashboard/domain/repositories/broker_dashboard_repository.dart';
import 'package:mobile_staff/features/broker/dashboard/domain/usecases/get_broker_dashboard.dart';
import 'package:mobile_staff/features/broker/dashboard/presentation/cubit/broker_dashboard_cubit.dart';

class _FakeRemote implements BrokerDashboardRemoteDataSource {
  _FakeRemote({this.dto, this.error});
  final BrokerDashboardDto? dto;
  final DioException? error;
  @override
  Future<BrokerDashboardDto> getDashboard() async {
    if (error != null) throw error!;
    return dto!;
  }
}

class _FakeRepo implements BrokerDashboardRepository {
  _FakeRepo(this._result);
  final Result<BrokerDashboard> _result;
  @override
  Future<Result<BrokerDashboard>> getDashboard() async => _result;
}

Map<String, dynamic> _json() => {
      'summary': {
        'leadsSubmitted': 12,
        'leadsApproved': 7,
        'reservationsCreated': 5,
        'reservationsApproved': 3,
        'commissionsPending': 2,
        'commissionsGross': '45000',
      },
      'recent': {
        'leads': [
          {'id': 'l1', 'fullName': 'Mona', 'stage': 'NEW', 'brokerApprovalStatus': 'PENDING',
           'projectInterest': {'name': {'en': 'Project'}}},
        ],
        'reservations': [
          {'id': 'r1', 'reservationNumber': 'R-1', 'status': 'PENDING', 'unit': {'code': 'A-1'}},
        ],
      },
    };

void main() {
  group('BrokerDashboardDto → entity', () {
    test('maps summary KPIs + recents', () {
      final d = BrokerDashboardDto.fromJson(_json()).toEntity();
      expect(d.leadsTotal, 12);
      expect(d.leadsApproved, 7);
      expect(d.reservationsTotal, 5);
      expect(d.reservationsApproved, 3);
      expect(d.commissionsPending, 2);
      expect(d.commissionsGross, 45000);
      expect(d.recentLeads.single.fullName, 'Mona');
      expect(d.recentLeads.single.projectName, 'Project');
      expect(d.recentReservations.single.reservationNumber, 'R-1');
    });

    test('tolerates missing summary/recent', () {
      final d = BrokerDashboardDto.fromJson(const {}).toEntity();
      expect(d.leadsTotal, 0);
      expect(d.recentLeads, isEmpty);
    });
  });

  group('BrokerDashboardRepositoryImpl', () {
    test('403 → forbidden', () async {
      final repo = BrokerDashboardRepositoryImpl(_FakeRemote(
        error: DioException(
          requestOptions: RequestOptions(path: '/portal/performance'),
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: 403),
        ),
      ));
      final r = await repo.getDashboard();
      expect(r.failureOrNull?.type, FailureType.forbidden);
    });

    test('success maps', () async {
      final repo = BrokerDashboardRepositoryImpl(_FakeRemote(dto: BrokerDashboardDto.fromJson(_json())));
      final r = await repo.getDashboard();
      expect(r.dataOrNull?.leadsTotal, 12);
    });
  });

  group('BrokerDashboardCubit', () {
    test('success emits data', () async {
      final cubit = BrokerDashboardCubit(GetBrokerDashboard(
        _FakeRepo(Ok(BrokerDashboardDto.fromJson(_json()).toEntity())),
      ));
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.data?.leadsApproved, 7);
    });

    test('failure emits failure', () async {
      final cubit = BrokerDashboardCubit(GetBrokerDashboard(
        _FakeRepo(Result.err(AppFailure(type: FailureType.forbidden))),
      ));
      await cubit.load();
      expect(cubit.state.status, DataStatus.failure);
    });
  });
}
