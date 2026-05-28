import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/reservations/data/dtos/reservation_dtos.dart';
import 'package:mobile_staff/features/reservations/data/mappers/reservation_mapper.dart';
import 'package:mobile_staff/features/reservations/data/datasources/reservations_remote_data_source.dart';
import 'package:mobile_staff/features/reservations/data/repositories/reservations_repository_impl.dart';
import 'package:mobile_staff/features/reservations/domain/entities/reservation.dart';
import 'package:mobile_staff/features/reservations/domain/repositories/reservations_repository.dart';
import 'package:mobile_staff/features/reservations/domain/usecases/reservation_use_cases.dart';
import 'package:mobile_staff/features/reservations/presentation/cubit/reservations_cubit.dart';

class _FakeRemote implements ReservationsRemoteDataSource {
  _FakeRemote({this.rows = const [], this.error});
  final List<ReservationDto> rows;
  final DioException? error;

  @override
  Future<List<ReservationDto>> list(ReservationsQuery query) async {
    if (error != null) throw error!;
    return rows;
  }

  @override
  Future<ReservationDetailDto> getOne(String id) async => throw UnimplementedError();
  @override
  Future<ReservationDto> create(NewReservation input) async => rows.first;
  @override
  Future<void> addNote(String id, String body) async {}
}

class _FakeRepo implements ReservationsRepository {
  _FakeRepo(this._list);
  final Result<List<Reservation>> _list;
  @override
  Future<Result<List<Reservation>>> getReservations(ReservationsQuery q) async => _list;
  @override
  Future<Result<ReservationDetail>> getReservation(String id) async => throw UnimplementedError();
  @override
  Future<Result<Reservation>> createReservation(NewReservation input) async => throw UnimplementedError();
  @override
  Future<Result<void>> addNote(String id, String body) async => const Ok(null);
}

Map<String, dynamic> _row({String status = 'PENDING'}) => {
      'id': 'r1',
      'status': status,
      'reservationNumber': 'R-1',
      'expiresAt': '2026-06-10T00:00:00.000Z',
      'bookingAmount': '50000',
      'client': {'fullName': 'Ali', 'phone': '+201'},
      'unit': {
        'code': 'A-1',
        'building': {'phase': {'project': {'name': {'ar': 'م', 'en': 'Project'}}}},
      },
    };

void main() {
  group('ReservationDto → entity', () {
    test('maps status/number/expiry/unit/project (nested)', () {
      final r = ReservationDto.fromJson(_row(status: 'APPROVED')).toEntity();
      expect(r.status, 'APPROVED');
      expect(r.reservationNumber, 'R-1');
      expect(r.unitCode, 'A-1');
      expect(r.projectName, 'Project');
      expect(r.clientName, 'Ali');
      expect(r.expiresAt, isNotNull);
      expect(r.bookingAmount, '50000');
    });

    test('detail merges notes + activities newest-first', () {
      final d = ReservationDetailDto.fromJson({
        ..._row(),
        'installmentPlanTemplate': {'name': 'Plan A'},
        'notes': [
          {'id': 'n1', 'body': 'Called', 'createdAt': '2026-06-01T00:00:00.000Z', 'author': {'fullName': 'Rep'}},
        ],
        'activities': [
          {'id': 'a1', 'status': 'CREATED', 'createdAt': '2026-06-02T00:00:00.000Z'},
        ],
      }).toEntity();
      expect(d.planName, 'Plan A');
      expect(d.timeline.first.id, 'a1'); // newest
      expect(d.timeline.last.isNote, isTrue);
    });
  });

  group('ReservationsRepositoryImpl error mapping', () {
    test('500 → server', () async {
      final repo = ReservationsRepositoryImpl(_FakeRemote(
        error: DioException(
          requestOptions: RequestOptions(path: '/reservations'),
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: 500),
        ),
      ));
      final r = await repo.getReservations(const ReservationsQuery());
      expect(r.failureOrNull?.type, FailureType.server);
    });

    test('success maps rows', () async {
      final repo = ReservationsRepositoryImpl(_FakeRemote(rows: [ReservationDto.fromJson(_row())]));
      final r = await repo.getReservations(const ReservationsQuery());
      expect(r.dataOrNull?.single.reservationNumber, 'R-1');
    });
  });

  group('ReservationsCubit', () {
    test('empty → empty', () async {
      final cubit = ReservationsCubit(GetReservations(_FakeRepo(const Ok([]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('setStatus filters + reloads', () async {
      final cubit = ReservationsCubit(GetReservations(_FakeRepo(Ok([
        const Reservation(id: 'r1', status: 'PENDING'),
      ]))));
      await cubit.setStatus('PENDING');
      expect(cubit.state.statusFilter, 'PENDING');
      expect(cubit.state.status, DataStatus.success);
    });
  });
}
