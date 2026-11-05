import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/reservations/data/dtos/reservation_dtos.dart';
import 'package:mobile_staff/features/reservations/data/mappers/reservation_mapper.dart';
import 'package:mobile_staff/features/reservations/domain/entities/reservation.dart';
import 'package:mobile_staff/features/reservations/presentation/screens/reservation_decision_card.dart';

/// F17 in the staff app — a sales manager approves or rejects a team
/// member's reservation; never their own.

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
