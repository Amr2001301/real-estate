import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  group('pure foundation', () {
    test('AppRole maps to/from backend wire values', () {
      expect(AppRole.fromWire('CUSTOMER'), AppRole.customer);
      expect(AppRole.fromWire('BROKER'), AppRole.broker);
      expect(AppRole.fromWire('???'), AppRole.guest);
      expect(AppRole.sales.isStaffSide, isTrue);
      expect(AppRole.customer.isCustomerSide, isTrue);
    });

    test('Result.when handles both branches', () {
      final ok = Result<int>.ok(42);
      final bad = Result<int>.err(AppFailure(type: FailureType.notFound));
      expect(ok.when(ok: (d) => d, err: (_) => -1), 42);
      expect(bad.when(ok: (_) => 0, err: (f) => f.type), FailureType.notFound);
    });

    test('DataState transitions carry status + failure', () {
      const initial = DataState<int>.initial();
      expect(initial.status, DataStatus.initial);
      final loaded = initial.toSuccess(5);
      expect(loaded.isSuccess, isTrue);
      expect(loaded.data, 5);
      final failed = loaded.toFailure(AppFailure(type: FailureType.server));
      expect(failed.isFailure, isTrue);
      // previous data is retained through a failure for optimistic UIs.
      expect(failed.data, 5);
    });
  });

  testWidgets('shared widgets render under theme + Arabic RTL localization',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('ar'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        theme: AppTheme.light(isArabic: true),
        darkTheme: AppTheme.dark(isArabic: true),
        home: Scaffold(
          body: Column(
            children: [
              AppButton(label: 'A', onPressed: () {}),
              const StatusBadge(label: 'NEW', tone: BadgeTone.gold),
              const AppCard(child: Text('card')),
              ErrorState(failure: AppFailure(type: FailureType.network)),
            ],
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(AppButton), findsOneWidget);
    expect(find.byType(StatusBadge), findsOneWidget);
    expect(Directionality.of(tester.element(find.byType(AppCard))),
        TextDirection.rtl);
  });
}
