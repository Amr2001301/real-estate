import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart' show Locale;
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/common/visit_status_label.dart';
import 'package:mobile_staff/features/visits/data/dtos/visit_dtos.dart';
import 'package:mobile_staff/features/visits/data/mappers/visit_mapper.dart';
import 'package:mobile_staff/features/visits/data/datasources/visits_remote_data_source.dart';
import 'package:mobile_staff/features/visits/data/repositories/visits_repository_impl.dart';
import 'package:mobile_staff/features/visits/domain/entities/visit.dart';
import 'package:mobile_staff/features/visits/domain/repositories/visits_repository.dart';
import 'package:mobile_staff/features/visits/domain/usecases/visit_use_cases.dart';
import 'package:mobile_staff/features/visits/presentation/cubit/visit_detail_cubit.dart';
import 'package:mobile_staff/features/visits/presentation/cubit/visits_cubit.dart';

class _FakeRemote implements VisitsRemoteDataSource {
  _FakeRemote({this.rows = const [], this.detail, this.error});
  final List<VisitDto> rows;
  final VisitDetailDto? detail;
  final DioException? error;
  final List<VisitTransition> applied = [];

  @override
  Future<List<VisitDto>> list(VisitsQuery query) async {
    if (error != null) throw error!;
    return rows;
  }

  @override
  Future<VisitDetailDto> getOne(String id) async {
    if (error != null) throw error!;
    return detail!;
  }

  @override
  Future<VisitDto> create(NewVisit input) async => rows.first;

  @override
  Future<void> transition(String id, VisitTransition t, String? notes, String? reason) async {
    applied.add(t);
  }
}

class _FakeRepo implements VisitsRepository {
  _FakeRepo(this._list);
  final Result<List<Visit>> _list;
  @override
  Future<Result<List<Visit>>> getVisits(VisitsQuery query) async => _list;
  @override
  Future<Result<VisitDetail>> getVisit(String id) async => throw UnimplementedError();
  @override
  Future<Result<Visit>> createVisit(NewVisit input) async => throw UnimplementedError();
  @override
  Future<Result<void>> updateStatus(String id, VisitTransition t, {String? notes, String? reason}) async =>
      const Ok(null);
}

Map<String, dynamic> _row({String status = 'SCHEDULED'}) => {
      'id': 'v1',
      'status': status,
      'visitNumber': 'V-1',
      'scheduledAt': '2026-06-01T10:00:00.000Z',
      'client': {'fullName': 'Mona', 'phone': '+201'},
      'project': {'name': {'ar': 'م', 'en': 'Project'}},
      'unit': {'code': 'A-1'},
    };

void main() {
  group('VisitDto → entity', () {
    test('maps client/project/unit + status', () {
      final v = VisitDto.fromJson(_row(status: 'CONFIRMED')).toEntity();
      expect(v.clientName, 'Mona');
      expect(v.clientPhone, '+201');
      expect(v.projectName, 'Project');
      expect(v.unitCode, 'A-1');
      expect(v.status, 'CONFIRMED');
      expect(v.scheduledAt, isNotNull);
    });

    test('detail merges activities newest-first', () {
      final d = VisitDetailDto.fromJson({
        ..._row(),
        'salesNotes': 'note',
        'visitActivities': [
          {'id': 'a1', 'type': 'created', 'createdAt': '2026-06-01T09:00:00.000Z'},
          {'id': 'a2', 'type': 'confirmed', 'createdAt': '2026-06-01T11:00:00.000Z'},
        ],
      }).toEntity();
      expect(d.salesNotes, 'note');
      expect(d.timeline.first.id, 'a2');
    });
  });

  group('VisitsRepositoryImpl error mapping', () {
    test('403 → forbidden', () async {
      final repo = VisitsRepositoryImpl(_FakeRemote(
        error: DioException(
          requestOptions: RequestOptions(path: '/visits/appointments'),
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: 403),
        ),
      ));
      final r = await repo.getVisits(const VisitsQuery());
      expect(r.failureOrNull?.type, FailureType.forbidden);
    });

    test('success maps rows', () async {
      final repo = VisitsRepositoryImpl(_FakeRemote(rows: [VisitDto.fromJson(_row())]));
      final r = await repo.getVisits(const VisitsQuery());
      expect(r.dataOrNull, hasLength(1));
    });

    test('transition delegates to the right endpoint', () async {
      final remote = _FakeRemote();
      final repo = VisitsRepositoryImpl(remote);
      await repo.updateStatus('v1', VisitTransition.complete);
      expect(remote.applied, [VisitTransition.complete]);
    });
  });

  group('VisitsCubit', () {
    test('empty → empty', () async {
      final cubit = VisitsCubit(GetVisits(_FakeRepo(const Ok([]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('toggleToday flips and reloads', () async {
      final cubit = VisitsCubit(GetVisits(_FakeRepo(Ok([
        const Visit(id: 'v1', status: 'SCHEDULED'),
      ]))));
      await cubit.toggleToday();
      expect(cubit.state.today, isTrue);
      expect(cubit.state.status, DataStatus.success);
    });
  });

  group('VisitDetailCubit', () {
    test('apply transition refreshes detail', () async {
      final remote = _FakeRemote(detail: VisitDetailDto.fromJson(_row(status: 'CONFIRMED')));
      final repo = VisitsRepositoryImpl(remote);
      final cubit = VisitDetailCubit(
        GetVisitDetail(repo),
        UpdateVisitStatus(repo),
        visitId: 'v1',
      );
      await cubit.load();
      expect(cubit.state.detail?.visit.status, 'CONFIRMED');
      await cubit.apply(VisitTransition.confirm);
      expect(remote.applied, contains(VisitTransition.confirm));
      expect(cubit.state.working, isFalse);
    });
  });

  // ─── P2 — Two-sided confirmation surface on Staff App ────────────────────

  group('VisitDto → entity (P2 new fields)', () {
    test('reads parent visitRequest preferred date/time and request notes', () {
      final v = VisitDto.fromJson({
        ..._row(status: 'SCHEDULED'),
        'visitRequest': {
          'id': 'r1',
          'preferredDate': '2026-06-01T08:00:00.000Z',
          'preferredTime': '08:00',
          'requestNotes': 'Customer message from P2 form',
          'customerName': 'Mona',
          'customerPhone': '+201',
        },
      }).toEntity();
      expect(v.requestPreferredDate, isNotNull);
      expect(v.requestPreferredTime, '08:00');
      expect(v.requestNotes, 'Customer message from P2 form');
    });

    test('falls back to legacy `notes` on the visitRequest for pre-P2 rows', () {
      final v = VisitDto.fromJson({
        ..._row(),
        'visitRequest': {'id': 'r1', 'notes': 'legacy message'},
      }).toEntity();
      expect(v.requestNotes, 'legacy message');
    });

    test('reads customerFeedback (customer reschedule reason)', () {
      final v = VisitDto.fromJson({
        ..._row(status: 'PENDING_RESCHEDULE'),
        'customerFeedback': 'work conflict',
      }).toEntity();
      expect(v.customerFeedback, 'work conflict');
      expect(v.status, 'PENDING_RESCHEDULE');
    });

    test('handles missing visitRequest gracefully', () {
      final v = VisitDto.fromJson(_row()).toEntity();
      expect(v.requestPreferredDate, isNull);
      expect(v.requestPreferredTime, isNull);
      expect(v.requestNotes, isNull);
    });
  });

  // The label/tone helpers are pure switches; verify the new wires.
  group('visitStatusLabel / visitStatusTone', () {
    late AppLocalizations l10n;

    setUpAll(() async {
      l10n = await AppLocalizations.delegate.load(const Locale('en'));
    });

    test('PENDING_RESCHEDULE label is the staff-side variant', () {
      expect(visitStatusLabel(l10n, 'PENDING_RESCHEDULE'),
          l10n.appointmentStatusPendingRescheduleStaff);
    });

    test('SCHEDULED is awaiting-customer (P2 semantics)', () {
      expect(visitStatusLabel(l10n, 'SCHEDULED'),
          l10n.appointmentStatusAwaitingCustomerStaff);
    });

    test('CONFIRMED is confirmed-by-customer', () {
      expect(visitStatusLabel(l10n, 'CONFIRMED'),
          l10n.appointmentStatusConfirmedByCustomerStaff);
    });

    test('PENDING_RESCHEDULE tone is warning', () {
      expect(visitStatusTone('PENDING_RESCHEDULE'), BadgeTone.warning);
    });

    test('unknown wire value falls through to the raw string', () {
      expect(visitStatusLabel(l10n, 'SOMETHING_NEW'), 'SOMETHING_NEW');
    });
  });

  group('allowedVisitTransitions', () {
    // Anchors so "past" / "future" don't drift across midnight while tests run.
    final now = DateTime.utc(2026, 6, 1, 12, 0);
    final past = now.subtract(const Duration(hours: 1));
    final future = now.add(const Duration(hours: 1));

    test('SCHEDULED → only cancel (waiting on customer)', () {
      final v = Visit(id: 'v', status: 'SCHEDULED', scheduledAt: future);
      expect(allowedVisitTransitions(v, now: now), [VisitTransition.cancel]);
    });

    test('CONFIRMED with future scheduledAt → complete + cancel (no-show hidden)',
        () {
      final v = Visit(id: 'v', status: 'CONFIRMED', scheduledAt: future);
      expect(allowedVisitTransitions(v, now: now),
          [VisitTransition.complete, VisitTransition.cancel]);
    });

    test('CONFIRMED with past scheduledAt → complete + cancel + no-show', () {
      final v = Visit(id: 'v', status: 'CONFIRMED', scheduledAt: past);
      expect(allowedVisitTransitions(v, now: now), [
        VisitTransition.complete,
        VisitTransition.cancel,
        VisitTransition.noShow,
      ]);
    });

    test('PENDING_RESCHEDULE → only cancel (admin must reschedule)', () {
      final v = Visit(id: 'v', status: 'PENDING_RESCHEDULE');
      expect(
          allowedVisitTransitions(v, now: now), [VisitTransition.cancel]);
    });

    test('terminal states → no transitions', () {
      for (final s in const ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED']) {
        final v = Visit(id: 'v', status: s, scheduledAt: past);
        expect(allowedVisitTransitions(v, now: now), isEmpty,
            reason: 'no transitions allowed from $s');
      }
    });

    test('CONFIRMED with null scheduledAt → no-show stays hidden', () {
      final v = Visit(id: 'v', status: 'CONFIRMED');
      expect(allowedVisitTransitions(v, now: now),
          [VisitTransition.complete, VisitTransition.cancel]);
    });
  });
}
