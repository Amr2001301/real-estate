import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/ledger/domain/ledger.dart';
import 'package:mobile_staff/features/ledger/presentation/ledger_screen.dart';
import 'package:mobile_staff/features/permissions/staff_permissions.dart';

/// «ليا وعليا» in the staff app reads the dashboard's API, so the numbers are
/// the dashboard's numbers.

Map<String, dynamic> _summary() => {
      'asOf': '2026-11-03',
      'receivables': {
        'total': '1250000.00',
        'groups': {
          'installments': {
            'amount': '1000000.00',
            'count': 12,
            'states': {
              'late': {'amount': '200000.00', 'count': 2},
              'upcoming': {'amount': '800000.00', 'count': 10},
            },
          },
          'bookings': {'amount': '200000.00', 'count': 2},
          'fees': {'amount': '50000.00', 'count': 3},
          'clawbacks': {'amount': '0.00', 'count': 0},
        },
      },
      'payables': {
        'total': '300000.00',
        'groups': {
          'commissions': {'amount': '250000.00', 'count': 4},
          'topUps': {'amount': '0.00', 'count': 0},
          'bonuses': {'amount': '50000.00', 'count': 1},
          'refunds': {'amount': '0.00', 'count': 0},
        },
        'onHold': {'amount': '15000.00', 'count': 1},
      },
      'net': '950000.00',
    };

class _Repo implements LedgerRepository {
  final calls = <({String? dateFrom, String? dateTo})>[];
  @override
  Future<Result<LedgerSummary>> summary({String? dateFrom, String? dateTo}) async {
    calls.add((dateFrom: dateFrom, dateTo: dateTo));
    return Ok(LedgerSummary.fromJson(_summary()));
  }

  @override
  Future<Result<Paginated<LedgerRow>>> rows(LedgerGroup group,
          {LedgerState? state, String? dateFrom, String? dateTo, int page = 1}) =>
      throw UnimplementedError();
}

void main() {
  test('parses the dashboard summary, onHold apart from the payables total', () {
    final s = LedgerSummary.fromJson(_summary());
    expect(s.receivables, 1250000);
    expect(s.payables, 300000);
    expect(s.net, 950000);
    expect(s.groups[LedgerGroup.installments]!.states[LedgerState.late]!.amount, 200000);
    expect(s.groups[LedgerGroup.onHold]!.amount, 15000);
  });

  test('periods are the dashboard\'s, from the company\'s today', () {
    final today = DateTime(2026, 11, 3);
    expect(ledgerPeriodRange(LedgerPeriod.thisMonth, today), (dateFrom: '2026-11-01', dateTo: '2026-11-30'));
    expect(ledgerPeriodRange(LedgerPeriod.nextMonth, DateTime(2026, 12, 9)), (dateFrom: '2027-01-01', dateTo: '2027-01-31'));
    expect(ledgerPeriodRange(LedgerPeriod.quarter, today), (dateFrom: '2026-10-01', dateTo: '2026-12-31'));
    expect(ledgerPeriodRange(LedgerPeriod.all, today), (dateFrom: null, dateTo: null));
  });

  test('opens for the admin or reports:financial:read, as on the dashboard', () {
    expect(StaffAccess.ledger(AppRole.admin, const StaffPermissions()), isTrue);
    expect(StaffAccess.ledger(AppRole.salesManager, const StaffPermissions()), isFalse);
    expect(StaffAccess.ledger(AppRole.sales, const StaffPermissions({'reports:financial:read'})), isTrue);
  });

  testWidgets('shows the API\'s totals and groups; a period reloads with its dates', (tester) async {
    final repo = _Repo();
    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: RepositoryProvider<LedgerRepository>.value(value: repo, child: const LedgerScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('home-fig-net')), findsOneWidget);
    expect(find.text('لصالح الشركة'), findsOneWidget);
    expect(find.byKey(const Key('home-fig-receivables')), findsOneWidget);
    expect(find.byKey(const Key('home-fig-payables')), findsOneWidget);
    expect(find.text('أقساط العقود'), findsOneWidget);

    await tester.tap(find.byKey(const Key('ledger-filters')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('ledger-period-LedgerPeriod.thisMonth')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('filter-apply')));
    await tester.pumpAndSettle();
    expect(repo.calls.last, (dateFrom: '2026-11-01', dateTo: '2026-11-30'));
  });
}
