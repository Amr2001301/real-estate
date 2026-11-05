import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/reports/reports_screen.dart';

class _Repo implements ReportsRepository {
  final periods = <ReportPeriod>[];

  @override
  Future<Result<SalesReport>> sales(ReportPeriod p, {DateTime? now}) async {
    periods.add(p);
    return const Ok(SalesReport(
      sales: 12500000,
      contracts: 5,
      collected: 3000000,
      fees: 20000,
      funnel: [40, 20, 10, 5],
      cohort: [40, 18, 9, 4],
      reservations: [('CONVERTED', 6), ('PENDING', 2)],
      projects: [ReportRank(id: 'p1', name: 'مشروع النخيل', count: 3, value: 8000000)],
      brokers: [ReportRank(id: 'b1', name: 'بيت الخبرة', count: 2, value: 120000)],
      trend: [('يناير', 1), ('فبراير', 4)],
    ));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

void main() {
  test('periods map to date ranges in the company\'s month, quarter and year', () {
    final today = DateTime(2026, 11, 5);
    expect(reportRange(ReportPeriod.thisMonth, today), (from: '2026-11-01', to: '2026-11-05'));
    expect(reportRange(ReportPeriod.lastMonth, today), (from: '2026-10-01', to: '2026-10-31'));
    expect(reportRange(ReportPeriod.quarter, today), (from: '2026-10-01', to: '2026-11-05'));
    expect(reportRange(ReportPeriod.year, today), (from: '2026-01-01', to: '2026-11-05'));
    expect(reportRange(ReportPeriod.lastMonth, DateTime(2026, 1, 10)), (from: '2025-12-01', to: '2025-12-31'));
  });

  test('conversion is the period\'s signed leads over its leads', () {
    expect(const SalesReport(cohort: [40, 18, 9, 4]).conversion, 10);
    expect(const SalesReport().conversion, isNull);
    expect(const SalesReport(sales: 100, contracts: 4).average, 25);
  });

  testWidgets('the report shows the figures, funnel, states, projects and brokers', (t) async {
    final repo = _Repo();
    await t.pumpWidget(MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: ReportsScreen(repository: repo),
    ));
    await t.pumpAndSettle();
    expect(find.text('التقارير'), findsOneWidget);
    expect(find.byKey(const Key('home-fig-contracts')), findsOneWidget);
    expect(find.textContaining('10%'), findsWidgets);
    for (final text in ['حالات الحجوزات', 'مشروع النخيل', 'بيت الخبرة']) {
      await t.scrollUntilVisible(find.text(text), 300, scrollable: find.byType(Scrollable).first);
      expect(find.text(text), findsOneWidget);
    }
    // The filter sheet picks another period and reloads.
    await t.scrollUntilVisible(find.byKey(const Key('reports-filters')), -300, scrollable: find.byType(Scrollable).first);
    await t.tap(find.byKey(const Key('reports-filters')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('report-period-ReportPeriod.year')));
    await t.tap(find.byKey(const Key('filter-apply')));
    await t.pumpAndSettle();
    expect(repo.periods, [ReportPeriod.thisMonth, ReportPeriod.year]);
  });
}
