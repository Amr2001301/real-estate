import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/reports/financial_report_screen.dart';
import 'package:mobile_staff/features/reports/reports_screen.dart';

const _json = <String, dynamic>{
  'summary': {
    'totalContractValue': '122460000',
    'totalCollected': '18000000',
    'collectedTowardsPrice': '17660000',
    'totalRemaining': '104800000',
    'totalOverdue': '500000',
    'overdueAmountComputed': '467200',
    'dueToDate': '18200000',
    'collectedAgainstDue': '17660000',
    'collectedThisMonth': '2560000',
    'dueThisMonth': '1790000',
    'refundsOwed': '30000',
  },
  'month': {'due': '1790000', 'paid': '900000', 'awaiting': '0', 'overdue': '100000', 'upcoming': '790000', 'cashIn': '2560000'},
  'aging': [
    {'label': '0-30', 'count': 3, 'amount': '300000'},
    {'label': '31-60', 'count': 1, 'amount': '167200'},
  ],
  'collectionByType': [
    {'type': 'INSTALLMENT', 'count': 9, 'totalAll': '9', 'totalCollected': '9000000', 'totalAwaiting': '120000'},
  ],
  'booking': {'pendingReservationsBookingAmount': '50000', 'approvedReservationsBookingAmount': '70000', 'bookingCollectedVerified': '400000', 'bookingUncollectedEstimate': '20000'},
  'liabilities': {
    'salesBonus': {'unpaidAmount': '10000'},
    'brokerCommissions': {'unpaidAmount': '396000'},
    'brokerPayouts': {'draftAmount': '1000', 'approvedAmount': '2000', 'processingAmount': '3000'},
    'clawbacksOwed': {'totalAmount': '5000'},
    'totalUnpaidLiabilities': '412000',
  },
  'overdue': [
    {
      'id': 'i1',
      'type': 'INSTALLMENT',
      'dueDate': '2026-10-01T00:00:00Z',
      'amount': '100000',
      'plan': {
        'contract': {
          'id': 'c1',
          'customer': {'fullName': 'مها سعيد'},
          'unit': {'code': 'A-101'},
        },
      },
    },
  ],
  'upcomingThisWeek': [],
  'recentDeposits': [
    {
      'id': 'd1',
      'type': 'INSTALLMENT',
      'amount': '50000',
      'paidAt': '2026-11-02T10:00:00Z',
      'verified': false,
      'contract': {
        'id': 'c1',
        'customer': {'fullName': 'علي حسن'},
      },
    },
  ],
};

class _Repo implements FinancialReportRepository {
  final loads = <(ReportPeriod, bool)>[];

  @override
  Future<Result<(FinancialReport, FinancialReport?)>> load(ReportPeriod p, {bool compare = false, DateTime? now}) async {
    loads.add((p, compare));
    final now0 = FinancialReport.fromJson(_json);
    return Ok((now0, compare ? const FinancialReport(collectedThisMonth: 1000000, collected: 10000000, overdue: 900000) : null));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

void main() {
  test('a period compares with the same dates a month, quarter or year earlier', () {
    expect(previousRange('2026-11-01', '2026-11-05', months: 1), (from: '2026-10-01', to: '2026-10-05'));
    expect(previousRange('2026-10-01', '2026-10-31', months: 1), (from: '2026-09-01', to: '2026-09-30'));
    expect(previousRange('2026-03-01', '2026-03-31', months: 1), (from: '2026-02-01', to: '2026-02-28'));
    expect(previousRange('2026-10-01', '2026-11-05', months: 3), (from: '2026-07-01', to: '2026-08-05'));
    expect(previousRange('2026-01-01', '2026-11-05', months: 12), (from: '2025-01-01', to: '2025-11-05'));
    expect(previousRange('2026-11-01', '2026-11-05'), (from: '2026-10-27', to: '2026-10-31')); // no months: equal length
    expect(comparisonMonths(ReportPeriod.quarter), 3);
  });

  test('change is a rounded percent, and nothing without a base', () {
    expect(percentChange(150, 100), 50);
    expect(percentChange(50, 100), -50);
    expect(percentChange(5, 0), isNull);
  });

  test('the report reads the dashboard\'s figures', () {
    final r = FinancialReport.fromJson(_json);
    expect(r.contractValue, 122460000);
    expect(r.collected, 17660000); // towards the price
    expect(r.overdue, 467200);
    expect(r.collectionRate, 97);
    expect(r.liabilities['payouts'], 6000);
    expect(r.liabilities['total'], 412000);
    expect(r.overdueRows.single.customer, 'مها سعيد');
    expect(r.deposits.single.verified, isFalse);
    expect(const FinancialReport().collectionRate, isNull);
  });

  testWidgets('the screen shows its sections and reloads with a comparison', (t) async {
    final repo = _Repo();
    await t.pumpWidget(MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: FinancialReportScreen(repository: repo),
    ));
    await t.pumpAndSettle();
    expect(find.text('التقرير المالي'), findsOneWidget);
    for (final k in ['fr-aging', 'fr-by-type', 'fr-booking', 'fr-liabilities', 'fr-overdue', 'fr-deposits']) {
      await t.scrollUntilVisible(find.byKey(Key(k)), 300, scrollable: find.byType(Scrollable).first);
      expect(find.byKey(Key(k)), findsOneWidget);
    }
    await t.scrollUntilVisible(find.byKey(const Key('financial-filters')), -300, scrollable: find.byType(Scrollable).first);
    await t.tap(find.byKey(const Key('financial-filters')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('report-compare-true')));
    await t.tap(find.byKey(const Key('filter-apply')));
    await t.pumpAndSettle();
    expect(repo.loads, [(ReportPeriod.thisMonth, false), (ReportPeriod.thisMonth, true)]);
    expect(find.textContaining('عن الفترة السابقة'), findsWidgets);
  });
}
