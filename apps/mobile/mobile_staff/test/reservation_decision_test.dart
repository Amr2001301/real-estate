import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/reservations/data/dtos/reservation_dtos.dart';
import 'package:mobile_staff/features/reservations/data/mappers/reservation_mapper.dart';
import 'package:mobile_staff/features/reservations/domain/entities/reservation.dart';
import 'package:mobile_staff/features/reservations/domain/repositories/reservations_repository.dart';
import 'package:mobile_staff/features/reservations/domain/usecases/reservation_use_cases.dart';
import 'package:mobile_staff/features/reservations/presentation/cubit/reservation_detail_cubit.dart';
import 'package:mobile_staff/features/reservations/presentation/screens/reservation_decision_card.dart';

/// F17 in the staff app — a sales manager approves or rejects a team
/// member's reservation; never their own.

class _Repo implements ReservationsRepository {
  _Repo({this.failWith});
  final AppFailure? failWith;
  String status = 'PENDING';
  final calls = <String>[];

  Reservation get _r => Reservation(id: 'r1', status: status, salesId: 'rep1', salesName: 'Rep One');

  @override
  Future<Result<ReservationDetail>> getReservation(String id) async =>
      Ok(ReservationDetail(reservation: _r, timeline: const []));

  @override
  Future<Result<void>> approve(String id) async {
    calls.add('approve:$id');
    if (failWith != null) return Err(failWith!);
    status = 'APPROVED';
    return const Ok(null);
  }

  @override
  Future<Result<void>> reject(String id, {String? reason}) async {
    calls.add('reject:$id:$reason');
    status = 'REJECTED';
    return const Ok(null);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

ReservationDetailCubit _cubit(_Repo repo) => ReservationDetailCubit(
      GetReservationDetail(repo),
      AddReservationNote(repo),
      reservationId: 'r1',
      approve: ApproveReservation(repo),
      reject: RejectReservation(repo),
    );

void main() {
  test('the rep who booked comes from the API', () {
    final r = ReservationDto.fromJson({
      'id': 'r1',
      'status': 'PENDING',
      'salesId': 'rep1',
      'sales': {'id': 'rep1', 'fullName': 'Rep One'},
    }).toEntity();
    expect(r.salesId, 'rep1');
    expect(r.salesName, 'Rep One');
  });

  group('who decides', () {
    const pending = Reservation(id: 'r1', status: 'PENDING', salesId: 'rep1');
    test('a manager on a rep\'s booking', () {
      expect(canDecideReservation(pending, role: AppRole.salesManager, userId: 'mgr'), isTrue);
    });
    test('never a manager on their own booking', () {
      expect(canDecideReservation(pending, role: AppRole.salesManager, userId: 'rep1'), isFalse);
    });
    test('the admin always; a rep never', () {
      expect(canDecideReservation(pending, role: AppRole.admin, userId: 'rep1'), isTrue);
      expect(canDecideReservation(pending, role: AppRole.sales, userId: 'other'), isFalse);
    });
    test('only while pending', () {
      const approved = Reservation(id: 'r1', status: 'APPROVED', salesId: 'rep1');
      expect(canDecideReservation(approved, role: AppRole.admin, userId: 'x'), isFalse);
    });
  });

  test('approve: the reservation reloads approved', () async {
    final repo = _Repo();
    final cubit = _cubit(repo);
    await cubit.load();
    await cubit.approve();
    expect(repo.calls, ['approve:r1']);
    expect(cubit.state.detail!.reservation.status, 'APPROVED');
    expect(cubit.state.decided, 'APPROVED');
    await cubit.close();
  });

  test('reject: the reason goes with it; a blank one is left out', () async {
    final repo = _Repo();
    final cubit = _cubit(repo);
    await cubit.load();
    await cubit.reject('  ');
    expect(repo.calls, ['reject:r1:null']);
    expect(cubit.state.decided, 'REJECTED');
    await cubit.close();

    final repo2 = _Repo();
    final cubit2 = _cubit(repo2);
    await cubit2.load();
    await cubit2.reject(' السعر مش مظبوط ');
    expect(repo2.calls, ['reject:r1:السعر مش مظبوط']);
    await cubit2.close();
  });

  test('a refusal from the API is shown, nothing decided', () async {
    final repo = _Repo(failWith: AppFailure(type: FailureType.forbidden));
    final cubit = _cubit(repo);
    await cubit.load();
    await cubit.approve();
    expect(cubit.state.actionFailure?.type, FailureType.forbidden);
    expect(cubit.state.decided, isNull);
    expect(cubit.state.working, isFalse);
    await cubit.close();
  });

  testWidgets('the card confirms before approving, and asks a reason to reject', (tester) async {
    var approved = 0;
    String? rejectedWith;
    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ReservationDecisionCard(
          reservation: const Reservation(id: 'r1', status: 'PENDING', salesId: 'rep1', salesName: 'Rep One'),
          working: false,
          onApprove: () => approved++,
          onReject: (r) => rejectedWith = r,
        ),
      ),
    ));

    expect(find.textContaining('Rep One'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('reservation-approve')));
    await tester.pumpAndSettle();
    expect(approved, 0); // not before the confirmation
    await tester.tap(find.byKey(const ValueKey('reservation-approve-confirm')));
    await tester.pumpAndSettle();
    expect(approved, 1);

    await tester.tap(find.byKey(const ValueKey('reservation-reject')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('reservation-reject-reason')), 'العميل اتراجع');
    await tester.tap(find.byKey(const ValueKey('reservation-reject-confirm')));
    await tester.pumpAndSettle();
    expect(rejectedWith, 'العميل اتراجع');
  });
}
