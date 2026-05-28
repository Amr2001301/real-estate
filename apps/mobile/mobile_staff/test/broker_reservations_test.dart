import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/broker/reservations/data/dtos/broker_reservation_dtos.dart';
import 'package:mobile_staff/features/broker/reservations/data/mappers/broker_reservation_mapper.dart';
import 'package:mobile_staff/features/broker/reservations/data/datasources/broker_reservations_remote_data_source.dart';
import 'package:mobile_staff/features/broker/reservations/data/repositories/broker_reservations_repository_impl.dart';
import 'package:mobile_staff/features/broker/reservations/domain/entities/broker_reservation.dart';
import 'package:mobile_staff/features/broker/reservations/domain/repositories/broker_reservations_repository.dart';
import 'package:mobile_staff/features/broker/reservations/domain/usecases/broker_reservation_use_cases.dart';
import 'package:mobile_staff/features/broker/reservations/presentation/cubit/broker_reservations_cubit.dart';

class _FakeRemote implements BrokerReservationsRemoteDataSource {
  _FakeRemote({this.rows = const [], this.error});
  final List<BrokerReservationDto> rows;
  final DioException? error;
  NewBrokerReservation? created;

  @override
  Future<List<BrokerReservationDto>> list(BrokerReservationsQuery query) async {
    if (error != null) throw error!;
    return rows;
  }

  @override
  Future<BrokerReservationDto> getOne(String id) async => throw UnimplementedError();

  @override
  Future<BrokerReservationDto> create(NewBrokerReservation input) async {
    created = input;
    return BrokerReservationDto.fromJson(_row());
  }
}

class _FakeRepo implements BrokerReservationsRepository {
  _FakeRepo(this._list);
  final Result<List<BrokerReservation>> _list;
  @override
  Future<Result<List<BrokerReservation>>> getReservations(BrokerReservationsQuery q) async => _list;
  @override
  Future<Result<BrokerReservationDetail>> getReservation(String id) async => throw UnimplementedError();
  @override
  Future<Result<BrokerReservation>> createReservation(NewBrokerReservation input) async => throw UnimplementedError();
}

Map<String, dynamic> _row({String status = 'PENDING'}) => {
      'id': 'r1',
      'status': status,
      'reservationNumber': 'R-1',
      'expiresAt': '2026-06-10T00:00:00.000Z',
      'unit': {'code': 'A-1', 'building': {'phase': {'project': {'name': {'en': 'Project'}}}}},
      'lead': {'fullName': 'Mona'},
    };

void main() {
  group('BrokerReservationDto → entity', () {
    test('maps status/number/expiry + nested project + lead name', () {
      final r = BrokerReservationDto.fromJson(_row(status: 'APPROVED')).toEntity();
      expect(r.status, 'APPROVED');
      expect(r.reservationNumber, 'R-1');
      expect(r.unitCode, 'A-1');
      expect(r.projectName, 'Project');
      expect(r.clientName, 'Mona');
      expect(r.expiresAt, isNotNull);
    });
  });

  group('BrokerReservationsRepositoryImpl', () {
    test('500 → server', () async {
      final repo = BrokerReservationsRepositoryImpl(_FakeRemote(
        error: DioException(
          requestOptions: RequestOptions(path: '/portal/reservations'),
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: 500),
        ),
      ));
      final r = await repo.getReservations(const BrokerReservationsQuery());
      expect(r.failureOrNull?.type, FailureType.server);
    });

    test('create passes leadId + unitId', () async {
      final remote = _FakeRemote();
      final repo = BrokerReservationsRepositoryImpl(remote);
      await repo.createReservation(const NewBrokerReservation(leadId: 'l1', unitId: 'u1'));
      expect(remote.created?.leadId, 'l1');
      expect(remote.created?.unitId, 'u1');
    });

    test('success maps rows', () async {
      final repo = BrokerReservationsRepositoryImpl(
        _FakeRemote(rows: [BrokerReservationDto.fromJson(_row())]),
      );
      final r = await repo.getReservations(const BrokerReservationsQuery());
      expect(r.dataOrNull?.single.reservationNumber, 'R-1');
    });
  });

  group('BrokerReservationsCubit', () {
    test('empty → empty', () async {
      final cubit = BrokerReservationsCubit(GetBrokerReservations(_FakeRepo(const Ok([]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('setStatus filters + reloads', () async {
      final cubit = BrokerReservationsCubit(GetBrokerReservations(_FakeRepo(Ok([
        const BrokerReservation(id: 'r1', status: 'PENDING'),
      ]))));
      await cubit.setStatus('PENDING');
      expect(cubit.state.statusFilter, 'PENDING');
      expect(cubit.state.status, DataStatus.success);
    });
  });
}
