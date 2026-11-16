import 'package:dio/dio.dart';
import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/splash/splash_screen.dart';

class _NoBranding extends BrandingRepository {
  _NoBranding() : super(Dio());
  @override
  Future<BrandTokens?> fetchBranding(String slug) async => null;
}

void main() {
  testWidgets('the splash shows the company, never the platform, and finishes', (tester) async {
    final cubit = BrandingCubit(_NoBranding(), fallbackName: 'شركة النخبة للتطوير العقاري');
    await tester.pumpWidget(
      BlocProvider.value(
        value: cubit,
        child: const MaterialApp(home: SplashScreen()),
      ),
    );
    await tester.pump(const Duration(milliseconds: 1000));

    expect(find.text('شركة النخبة للتطوير العقاري'), findsOneWidget);
    // Nothing of the platform: no stock wordmark, no platform name.
    expect(find.textContaining('REAL ESTATE'), findsNothing);
    expect(find.textContaining('Devora'), findsNothing);

    expect(SplashScreen.splashDone.value, isFalse);
    await tester.pump(SplashScreen.holdDuration);
    expect(SplashScreen.splashDone.value, isTrue);
  });
}
