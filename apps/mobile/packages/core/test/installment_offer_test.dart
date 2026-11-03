import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app(Widget child) => MaterialApp(
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: AppTheme.light(isArabic: true),
      home: Scaffold(body: child),
    );

void main() {
  group('installmentOfferFromTemplateJson (same sums as the API)', () {
    test('duration plan: remainder split by month, increase applied', () {
      final o = installmentOfferFromTemplateJson({
        'name': 'A',
        'netPrice': '1000000',
        'reservationAmount': '50000',
        'downPaymentAmount': '50000',
        'finalPaymentAmount': null,
        'durationOptions': [
          {'durationMonths': 96, 'increasePercentage': '10', 'order': 1},
          {'durationMonths': 60, 'increasePercentage': '0', 'order': 0},
        ],
      });
      expect(o.upfront, 100000);
      // The down payment alone; the booking is its own line.
      expect(o.downPaymentPercent, 5);
      expect([for (final x in o.options) x.durationMonths], [60, 96]);
      expect(o.options[0].amount, 15000);
      expect(o.options[1].amount, 10312.5);
      expect(o.options[1].totalPayable, 1090000);
      expect(o.cheapest!.durationMonths, 96);
      expect(o.longest!.durationMonths, 96);
    });

    test('legacy plan: one option at its own frequency', () {
      final o = installmentOfferFromTemplateJson({
        'name': 'B',
        'netPrice': 1000000,
        'reservationAmount': 0,
        'downPaymentAmount': 200000,
        'installmentsCount': 8,
        'frequency': 'QUARTERLY',
        'durationOptions': [],
      });
      expect(o.options.single.period, InstallmentPeriod.quarterly);
      expect(o.options.single.durationMonths, 24);
      expect(o.options.single.amount, 100000);
    });

    test('cash plan has no instalments', () {
      final o = installmentOfferFromTemplateJson({
        'name': 'C',
        'isCash': true,
        'netPrice': 1000000,
        'reservationAmount': 100000,
        'downPaymentAmount': 900000,
      });
      expect(o.options, isEmpty);
      expect(o.cheapest, isNull);
    });
  });

  group('texts', () {
    testWidgets('durations and the "from" line read in Arabic with Western digits', (tester) async {
      late AppLocalizations l10n;
      await tester.pumpWidget(_app(Builder(builder: (context) {
        l10n = context.l10n;
        return const SizedBox();
      })));
      expect(durationText(l10n, 96), '8 سنوات');
      expect(durationText(l10n, 12), 'سنة');
      expect(durationText(l10n, 24), 'سنتان');
      expect(durationText(l10n, 18), '18 شهرًا');
      final offer = installmentOfferFromTemplateJson({
        'name': 'A',
        'netPrice': 1000000,
        'reservationAmount': 50000,
        'downPaymentAmount': 50000,
        'durationOptions': [
          {'durationMonths': 60, 'increasePercentage': 0},
        ],
      });
      expect(cheapestInstallmentLine(l10n, 'ar', [offer]), 'أو من 15,000 ج.م شهريًا');
      expect(offer.downPaymentPercentLabel, '\u20665%\u2069');
      expect(
        projectOfferLine(l10n, ProjectPlanSummary.fromOffers([offer])),
        'مقدم \u20665%\u2069 وتقسيط حتى 5 سنوات',
      );
    });
  });

  group('widgets', () {
    testWidgets('gallery shows the counter and opens full screen', (tester) async {
      await tester.pumpWidget(_app(const SingleChildScrollView(
        child: AppPhotoGallery(images: ['a', 'b', 'c', 'd', 'e', 'f', 'g']),
      )));
      expect(find.text('\u20661 / 7\u2069'), findsOneWidget);
      expect(find.text('+3'), findsOneWidget);
      await tester.tap(find.byKey(const Key('detail-gallery-fullscreen')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('photo-viewer')), findsOneWidget);
      await tester.tap(find.byKey(const Key('photo-viewer-close')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('photo-viewer')), findsNothing);
    });

    testWidgets('calculator switches durations', (tester) async {
      final offer = installmentOfferFromTemplateJson({
        'name': 'A',
        'netPrice': 1000000,
        'reservationAmount': 50000,
        'downPaymentAmount': 50000,
        'durationOptions': [
          {'durationMonths': 60, 'increasePercentage': 0},
          {'durationMonths': 96, 'increasePercentage': 10},
        ],
      });
      await tester.pumpWidget(_app(Builder(
        builder: (context) => TextButton(
          onPressed: () => showInstallmentCalculator(context, subtitle: 'A-1', offers: [offer]),
          child: const Text('open'),
        ),
      )));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text('15,000 ج.م'), findsOneWidget);
      await tester.tap(find.byKey(const Key('calc-duration-1')));
      await tester.pumpAndSettle();
      expect(find.text('10,313 ج.م'), findsOneWidget);
      expect(find.text('8 سنوات'), findsOneWidget);
    });

    testWidgets('plan table lists booking, down payment, instalments and total', (tester) async {
      final offer = installmentOfferFromTemplateJson({
        'name': 'A',
        'netPrice': 1000000,
        'reservationAmount': 50000,
        'downPaymentAmount': 50000,
        'durationOptions': [
          {'durationMonths': 60, 'increasePercentage': 0},
        ],
      });
      await tester.pumpWidget(_app(AppPaymentPlanTable(offer: offer)));
      expect(find.text('دفعة الحجز'), findsOneWidget);
      expect(find.text('الأقساط (60)'), findsOneWidget);
      expect(find.text('15,000 ج.م شهريًا'), findsOneWidget);
      expect(find.text('1,000,000 ج.م'), findsOneWidget);
    });
  });
}
