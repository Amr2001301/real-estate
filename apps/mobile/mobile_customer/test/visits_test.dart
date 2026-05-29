import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/visits/data/dtos/visit_request_dto.dart';
import 'package:mobile_customer/features/visits/data/mappers/visit_request_mapper.dart';
import 'package:mobile_customer/features/visits/domain/entities/visit_request.dart';
import 'package:mobile_customer/features/visits/domain/repositories/visits_repository.dart';
import 'package:mobile_customer/features/visits/domain/usecases/confirm_visit_appointment.dart';
import 'package:mobile_customer/features/visits/domain/usecases/create_visit_request.dart';
import 'package:mobile_customer/features/visits/domain/usecases/get_my_visit_requests.dart';
import 'package:mobile_customer/features/visits/domain/usecases/request_visit_reschedule.dart';
import 'package:mobile_customer/features/visits/presentation/my_visits_cubit.dart';
import 'package:mobile_customer/features/visits/presentation/visit_request_cubit.dart';

class _FakeVisitsRepository implements VisitsRepository {
  _FakeVisitsRepository({
    this.createFailure,
    this.list = const [],
    this.confirmFailure,
    this.rescheduleFailure,
  });

  final AppFailure? createFailure;
  final List<VisitRequest> list;

  /// When non-null, [confirmAppointment] returns this failure instead of `Ok`.
  final AppFailure? confirmFailure;
  /// When non-null, [requestReschedule] returns this failure instead of `Ok`.
  final AppFailure? rescheduleFailure;

  // Recorders so cubit tests can assert what was called with what arguments.
  final List<String> confirmedIds = [];
  final List<({String id, String? reason})> rescheduleCalls = [];

  /// How many times `getMyVisitRequests` was invoked. The cubit refreshes
  /// the list on any successful action, so tests assert refresh-on-success.
  int listCalls = 0;

  @override
  Future<Result<void>> createVisitRequest(CreateVisitParams params) async =>
      createFailure != null ? Result.err(createFailure!) : const Ok(null);

  @override
  Future<Result<Paginated<VisitRequest>>> getMyVisitRequests({
    int page = 1,
    int pageSize = 20,
  }) async {
    listCalls++;
    return Result.ok(Paginated(
      data: list,
      meta: PageMeta(page: 1, pageSize: pageSize, total: list.length, totalPages: 1),
    ));
  }

  @override
  Future<Result<void>> confirmAppointment(String appointmentId) async {
    confirmedIds.add(appointmentId);
    return confirmFailure != null ? Result.err(confirmFailure!) : const Ok(null);
  }

  @override
  Future<Result<void>> requestReschedule(
    String appointmentId, {
    String? reason,
  }) async {
    rescheduleCalls.add((id: appointmentId, reason: reason));
    return rescheduleFailure != null
        ? Result.err(rescheduleFailure!)
        : const Ok(null);
  }
}

VisitRequest _visitWithAppointment({
  String id = 'v1',
  AppointmentStatus apptStatus = AppointmentStatus.scheduled,
  String apptId = 'a1',
  String? customerFeedback,
}) {
  return VisitRequest(
    id: id,
    projectId: 'p1',
    status: VisitStatus.scheduled,
    preferredDate: DateTime.utc(2030, 6, 1, 14, 0),
    appointments: [
      AppointmentSummary(
        id: apptId,
        status: apptStatus,
        scheduledAt: DateTime.utc(2030, 6, 1, 16, 0),
        customerFeedback: customerFeedback,
      ),
    ],
  );
}

void main() {
  group('VisitRequestDto → entity mapper', () {
    test('maps wire status + dates + project name + appointment status', () {
      final entity = VisitRequestDto.fromJson({
        'id': 'v1',
        'projectId': 'p1',
        'status': 'SCHEDULED',
        'preferredDate': '2026-06-01T15:00:00.000Z',
        'preferredTime': '15:00',
        'requestNotes': 'P2 message',
        'project': {'name': {'ar': 'أبراج', 'en': 'Towers'}},
        'assignedSales': {'id': 's1', 'fullName': 'Sales One'},
        'appointments': [
          {
            'id': 'a1',
            'status': 'PENDING_RESCHEDULE',
            'scheduledAt': '2026-06-01T16:00:00.000Z',
            'customerFeedback': 'work conflict',
          },
        ],
      }).toEntity();
      expect(entity.status, VisitStatus.scheduled);
      expect(entity.projectName?.resolve('en'), 'Towers');
      expect(entity.preferredDate, isNotNull);
      expect(entity.preferredTime, '15:00');
      // P2 — requestNotes wins over legacy notes.
      expect(entity.notes, 'P2 message');
      expect(entity.assignedSalesName, 'Sales One');
      expect(entity.appointments, hasLength(1));
      expect(entity.appointments.first.status,
          AppointmentStatus.pendingReschedule);
      expect(entity.appointments.first.customerFeedback, 'work conflict');
      expect(entity.latestAppointment?.id, 'a1');
    });

    test('falls back to legacy `notes` when requestNotes is null', () {
      final entity = VisitRequestDto.fromJson({
        'id': 'v',
        'projectId': 'p',
        'status': 'PENDING',
        'notes': 'old row message',
      }).toEntity();
      expect(entity.notes, 'old row message');
    });

    test('unknown status falls back', () {
      final e = VisitRequestDto.fromJson({'id': 'v', 'projectId': 'p', 'status': 'X'})
          .toEntity();
      expect(e.status, VisitStatus.unknown);
    });

    test('unknown appointment status falls back', () {
      final e = VisitRequestDto.fromJson({
        'id': 'v',
        'projectId': 'p',
        'status': 'PENDING',
        'appointments': [
          {'id': 'a1', 'status': 'SOMETHING_NEW'},
        ],
      }).toEntity();
      expect(e.appointments.first.status, AppointmentStatus.unknown);
    });

    test('handles empty appointments list', () {
      final e = VisitRequestDto.fromJson({
        'id': 'v',
        'projectId': 'p',
        'status': 'PENDING',
      }).toEntity();
      expect(e.appointments, isEmpty);
      expect(e.latestAppointment, isNull);
    });
  });

  group('AppointmentStatus.isTerminal', () {
    test('terminal states', () {
      expect(AppointmentStatus.completed.isTerminal, isTrue);
      expect(AppointmentStatus.cancelled.isTerminal, isTrue);
      expect(AppointmentStatus.noShow.isTerminal, isTrue);
      expect(AppointmentStatus.rescheduled.isTerminal, isTrue);
    });
    test('non-terminal states', () {
      expect(AppointmentStatus.scheduled.isTerminal, isFalse);
      expect(AppointmentStatus.confirmed.isTerminal, isFalse);
      expect(AppointmentStatus.pendingReschedule.isTerminal, isFalse);
    });
  });

  group('AppointmentSummary.awaitsCustomer', () {
    test('only SCHEDULED is "awaits customer"', () {
      const a = AppointmentSummary(id: 'a', status: AppointmentStatus.scheduled);
      const b = AppointmentSummary(id: 'a', status: AppointmentStatus.confirmed);
      const c = AppointmentSummary(
          id: 'a', status: AppointmentStatus.pendingReschedule);
      expect(a.awaitsCustomer, isTrue);
      expect(b.awaitsCustomer, isFalse);
      expect(c.awaitsCustomer, isFalse);
    });
  });

  group('ConfirmVisitAppointment use case', () {
    test('delegates to the repository', () async {
      final repo = _FakeVisitsRepository();
      await ConfirmVisitAppointment(repo)('appt-42');
      expect(repo.confirmedIds, ['appt-42']);
    });

    test('returns the repository failure unchanged', () async {
      final failure = AppFailure(type: FailureType.notFound);
      final repo = _FakeVisitsRepository(confirmFailure: failure);
      final r = await ConfirmVisitAppointment(repo)('appt-42');
      expect(r.failureOrNull, same(failure));
    });
  });

  group('RequestVisitReschedule use case', () {
    test('forwards the reason to the repository', () async {
      final repo = _FakeVisitsRepository();
      await RequestVisitReschedule(repo)(
        const RequestVisitRescheduleParams(
          appointmentId: 'appt-42',
          reason: 'work conflict',
        ),
      );
      expect(repo.rescheduleCalls, hasLength(1));
      expect(repo.rescheduleCalls.first.id, 'appt-42');
      expect(repo.rescheduleCalls.first.reason, 'work conflict');
    });

    test('reason can be null', () async {
      final repo = _FakeVisitsRepository();
      await RequestVisitReschedule(repo)(
        const RequestVisitRescheduleParams(appointmentId: 'appt-42'),
      );
      expect(repo.rescheduleCalls.first.reason, isNull);
    });
  });

  group('VisitRequestCubit', () {
    final params = CreateVisitParams(projectId: 'p1', preferredDate: DateTime(2026, 6, 1));

    test('submit success emits success', () async {
      final cubit = VisitRequestCubit(CreateVisitRequest(_FakeVisitsRepository()));
      await cubit.submit(params);
      expect(cubit.state.status, VisitFormStatus.success);
    });

    test('submit failure surfaces an AppFailure', () async {
      final repo = _FakeVisitsRepository(createFailure: AppFailure(type: FailureType.server));
      final cubit = VisitRequestCubit(CreateVisitRequest(repo));
      await cubit.submit(params);
      expect(cubit.state.status, VisitFormStatus.failure);
      expect(cubit.state.failure?.type, FailureType.server);
    });
  });

  group('MyVisitsCubit', () {
    test('empty when no requests', () async {
      final cubit = MyVisitsCubit(GetMyVisitRequests(_FakeVisitsRepository()));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('success with requests', () async {
      final repo = _FakeVisitsRepository(list: [
        _visitWithAppointment(),
      ]);
      final cubit = MyVisitsCubit(GetMyVisitRequests(repo));
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.data, hasLength(1));
    });

    group('confirm action', () {
      test('on success, emits success outcome and refreshes the list',
          () async {
        final repo = _FakeVisitsRepository(list: [_visitWithAppointment()]);
        final cubit = MyVisitsCubit(
          GetMyVisitRequests(repo),
          confirmVisitAppointment: ConfirmVisitAppointment(repo),
        );
        await cubit.load();
        final listCallsBefore = repo.listCalls;

        await cubit.confirmAppointment('appt-1');

        expect(repo.confirmedIds, ['appt-1']);
        // List was re-fetched exactly once after the action.
        expect(repo.listCalls, listCallsBefore + 1);
        expect(cubit.state.lastOutcome?.isSuccess, isTrue);
        expect(cubit.state.lastOutcome?.kind, VisitActionKind.confirm);
        expect(cubit.state.inFlightAppointmentId, isNull);
      });

      test('on failure, emits failure outcome and keeps the existing list',
          () async {
        final failure = AppFailure(type: FailureType.notFound);
        final repo = _FakeVisitsRepository(
          list: [_visitWithAppointment()],
          confirmFailure: failure,
        );
        final cubit = MyVisitsCubit(
          GetMyVisitRequests(repo),
          confirmVisitAppointment: ConfirmVisitAppointment(repo),
        );
        await cubit.load();
        final listCallsBefore = repo.listCalls;

        await cubit.confirmAppointment('appt-1');

        expect(cubit.state.lastOutcome?.isSuccess, isFalse);
        expect(cubit.state.lastOutcome?.failure?.type, FailureType.notFound);
        // No refresh on failure — the previous list view stays visible.
        expect(repo.listCalls, listCallsBefore);
        expect(cubit.state.inFlightAppointmentId, isNull);
        // List data is still rendered.
        expect(cubit.state.data, hasLength(1));
      });
    });

    group('requestReschedule action', () {
      test('on success, refreshes and forwards the reason', () async {
        final repo = _FakeVisitsRepository(list: [_visitWithAppointment()]);
        final cubit = MyVisitsCubit(
          GetMyVisitRequests(repo),
          requestVisitReschedule: RequestVisitReschedule(repo),
        );
        await cubit.load();
        final before = repo.listCalls;

        await cubit.requestReschedule('appt-1', reason: 'work conflict');

        expect(repo.rescheduleCalls, hasLength(1));
        expect(repo.rescheduleCalls.first.reason, 'work conflict');
        expect(repo.listCalls, before + 1);
        expect(cubit.state.lastOutcome?.isSuccess, isTrue);
        expect(cubit.state.lastOutcome?.kind,
            VisitActionKind.requestReschedule);
      });

      test('on failure, surfaces the AppFailure outcome', () async {
        final failure = AppFailure(type: FailureType.network);
        final repo = _FakeVisitsRepository(
          list: [_visitWithAppointment()],
          rescheduleFailure: failure,
        );
        final cubit = MyVisitsCubit(
          GetMyVisitRequests(repo),
          requestVisitReschedule: RequestVisitReschedule(repo),
        );
        await cubit.load();

        await cubit.requestReschedule('appt-1', reason: null);

        expect(cubit.state.lastOutcome?.isSuccess, isFalse);
        expect(cubit.state.lastOutcome?.failure?.type, FailureType.network);
      });
    });

    test('actions are no-ops when use cases are not provided', () async {
      // The router wires the optional use cases in production; protecting
      // older provider sites means tapping the button before the cubit was
      // fully wired does nothing instead of crashing.
      final cubit = MyVisitsCubit(GetMyVisitRequests(_FakeVisitsRepository()));
      await cubit.confirmAppointment('x');
      await cubit.requestReschedule('x');
      expect(cubit.state.lastOutcome, isNull);
    });
  });
}
