import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/catalog/presentation/home/customer_home_dashboard.dart';
import 'package:mobile_customer/features/home_summary/domain/entities/home_summary.dart';

/// The home installments card is compact: the next amount and date, a
/// progress bar and one «X من Y مدفوع» line, not a four-number stats row.

HomeSummaryInstallments _inst({int overdue = 0, int paid = 0}) =>
    HomeSummaryInstallments(
      paidCount: paid,
      totalCount: 25,
      remainingCount: 25 - paid,
      overdueCount: overdue,
      nextDue: HomeSummaryNextDue(
        id: 'i1',
        amount: '200000.00',
        currency: 'EGP',
        dueDate: DateTime(2026, 11, 16),
        status: overdue > 0 ? 'OVERDUE' : 'PENDING',
      ),
    );

Future<void> _pump(WidgetTester tester, HomeSummaryInstallments i) async {
  await tester.pumpWidget(MaterialApp(
    theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
    locale: const Locale('ar'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(
      body: SingleChildScrollView(
        child: SizedBox(width: 360, child: HomeFinancialCard(installments: i)),
      ),
    ),
  ));
  await tester.pump();
}

void main() {
  testWidgets('on track: one summary line, no stats row, short card', (tester) async {
    await _pump(tester, _inst());
    expect(find.text('0 من 25 مدفوع · 0%'), findsOneWidget);
    expect(find.text('الجدول ›'), findsOneWidget);
    expect(find.text('منتظم'), findsOneWidget);
    // The old four-number footer is gone.
    expect(find.text('المتبقي'), findsNothing);
    expect(find.text('قيد الانتظار'), findsNothing);
    expect(tester.getSize(find.byType(HomeFinancialCard)).height, lessThan(170));
  });

  testWidgets('overdue: red badge and the overdue count line', (tester) async {
    await _pump(tester, _inst(overdue: 2, paid: 3));
    expect(find.text('2 متأخرة'), findsOneWidget);
    expect(find.textContaining('متأخر'), findsNWidgets(2));
    expect(find.text('3 من 25 مدفوع · 12%'), findsOneWidget);
  });
}
