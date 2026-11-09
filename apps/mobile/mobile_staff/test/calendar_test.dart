import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/calendar/domain/calendar_event.dart';
import 'package:mobile_staff/features/calendar/presentation/calendar_cubit.dart';
import 'package:mobile_staff/features/calendar/presentation/calendar_screen.dart';

/// CAL1 in the staff app: the week's diary, a day at a time.

class _Repo implements CalendarRepository {
  _Repo(this.byWeek);
  final Map<String, List<CalendarEvent>> byWeek;
  final calls = <String>[];

  @override
  Future<Result<List<CalendarEvent>>> events(DateTime from, DateTime to) async {
    calls.add('${calendarDay(from)}..${calendarDay(to)}');
    return Ok(byWeek[calendarDay(from)] ?? const []);
  }
}

CalendarEvent _ev(String type, String id, DateTime at, {String? customer, String? leadId}) =>
    CalendarEvent(type: type, id: id, at: at, customer: customer, leadId: leadId);

void main() {
  group('CalendarEvent', () {
    test('reads each kind of entry, in the phone\'s time', () {
      final e = CalendarEvent.fromJson({
        'type': 'follow_up',
        'id': 'l1',
        'at': '2026-11-02T08:00:00.000Z',
        'leadId': 'l1',
        'customer': 'Mona',
        'project': {'ar': 'جولف', 'en': 'Golf'},
        'kind': 'CALL',
        'note': 'العرض',
        'sales': {'id': 's1', 'fullName': 'Rep'},
      });
      expect(e.at, DateTime.utc(2026, 11, 2, 8).toLocal());
      expect(e.project?.resolve('ar'), 'جولف');
      expect(e.kind, 'CALL');
      expect(e.salesName, 'Rep');
      // A flattened project name reads the same.
      expect(CalendarEvent.fromJson({'type': 'visit', 'id': 'v', 'at': '2026-11-02T08:00:00Z', 'project': 'Golf'}).project?.resolve('ar'), 'Golf');
    });

    test('each entry opens its own screen', () {
      final at = DateTime(2026, 11, 2);
      expect(_ev('visit', 'v1', at).route, '/visits/v1');
      expect(_ev('follow_up', 'l1', at, leadId: 'l1').route, '/leads/l1');
      expect(_ev('done', 'n1', at, leadId: 'l2').route, '/leads/l2');
      expect(_ev('reservation_expiry', 'r1', at).route, '/reservations/r1');
      expect(_ev('contract_signed', 'c1', at).route, '/contracts/c1');
      expect(_ev('visit_request', 'x', at).route, isNull);
    });
  });

  group('CalendarCubit', () {
    test('a week runs Saturday to Friday', () {
      expect(CalendarCubit.saturdayOf(DateTime(2026, 11, 1)), DateTime(2026, 10, 31)); // Sunday → Sat
      expect(CalendarCubit.saturdayOf(DateTime(2026, 10, 31)), DateTime(2026, 10, 31)); // Saturday
      expect(CalendarCubit.saturdayOf(DateTime(2026, 11, 6)), DateTime(2026, 10, 31)); // Friday
    });

    test('opens on today\'s week, moves a week at a time and back to today', () async {
      final repo = _Repo({});
      final cubit = CalendarCubit(repo, now: () => DateTime(2026, 11, 1, 13));
      await cubit.load();
      expect(cubit.state.selected, DateTime(2026, 11, 1));
      expect(repo.calls.last, '2026-10-31..2026-11-06');

      await cubit.shiftWeek(1);
      expect(cubit.state.weekStart, DateTime(2026, 11, 7));
      expect(cubit.state.selected, DateTime(2026, 11, 8)); // same weekday
      expect(repo.calls.last, '2026-11-07..2026-11-13');

      await cubit.goToday();
      expect(cubit.state.selected, DateTime(2026, 11, 1));
      expect(repo.calls.last, '2026-10-31..2026-11-06');
    });

    test('the day\'s entries', () async {
      final repo = _Repo({
        '2026-10-31': [
          _ev('visit', 'v1', DateTime(2026, 11, 1, 10), customer: 'A'),
          _ev('follow_up', 'l1', DateTime(2026, 11, 2, 9), customer: 'B', leadId: 'l1'),
        ],
      });
      final cubit = CalendarCubit(repo, now: () => DateTime(2026, 11, 1, 8));
      await cubit.load();
      expect(cubit.state.on(DateTime(2026, 11, 1)).map((e) => e.id), ['v1']);
      expect(cubit.state.on(DateTime(2026, 11, 2)).map((e) => e.id), ['l1']);
    });
  });

  testWidgets('the screen lists the picked day; another day shows its own', (tester) async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    // Each entry goes into the load of the week it falls in.
    final repo = _Repo({});
    for (final e in [
      _ev('visit', 'v1', today.add(const Duration(hours: 10)), customer: 'Mona'),
      _ev('follow_up', 'l1', tomorrow.add(const Duration(hours: 11)), customer: 'Ali', leadId: 'l1'),
    ]) {
      (repo.byWeek[calendarDay(CalendarCubit.saturdayOf(e.at))] ??= []).add(e);
    }

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: BlocProvider(create: (_) => CalendarCubit(repo), child: const CalendarScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Mona'), findsOneWidget);
    expect(find.text('Ali'), findsNothing);

    // On a Friday tomorrow starts the next week: go there first. Going to
    // another week keeps the weekday that was picked, so tomorrow is tapped
    // in either case.
    if (CalendarCubit.saturdayOf(today) != CalendarCubit.saturdayOf(tomorrow)) {
      await tester.tap(find.byKey(const Key('calendar-next')));
      await tester.pumpAndSettle();
    }
    await tester.tap(find.byKey(ValueKey('day-${calendarDay(tomorrow)}')));
    await tester.pumpAndSettle();
    expect(find.text('Ali'), findsOneWidget);
    expect(find.text('Mona'), findsNothing);
  });
}
