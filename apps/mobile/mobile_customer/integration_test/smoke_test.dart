// Phase 7A — Customer App integration smoke (LOCAL ONLY, not in CI).
//
// Boots the full Customer App via the dev entrypoint and confirms it
// settles to a first interactive surface (login or splash → guest home)
// without crashing or producing a red-screen error widget. This is the
// thinnest possible smoke — heavier integration flows (login → catalog →
// favorite → maintenance) come in Phase 7B with an emulator harness and
// the e2e backend running.
//
// Run locally on an attached device / emulator:
//
//   cd apps/mobile/mobile_customer
//   flutter test integration_test/smoke_test.dart
//
// Or, with a backend running and pointed at the e2e DB:
//
//   flutter test integration_test/smoke_test.dart \
//     --dart-define=API_BASE_URL=http://10.0.2.2:4000/v1   # Android emu
//     # or http://localhost:4000/v1 on iOS simulator

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_customer/main_dev.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Customer App boots without throwing and renders a first screen',
      (tester) async {
    // Run the actual app entrypoint. EnvConfig.dev is wired inside the
    // entrypoint; we don't override it here so the smoke matches what a
    // developer running `flutter run -t lib/main_dev.dart` would see.
    app.main();

    // Pump for a generous window so MaterialApp + GoRouter + initial
    // session-restore cubits all settle. `pumpAndSettle` would hang on
    // long-lived animations; a bounded pump is fine for a smoke.
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 2));

    // No FlutterError thrown into the test binding's queue.
    expect(tester.takeException(), isNull);

    // At least one Widget tree is rendered (the app has SOMETHING on
    // screen, not a black void). Specific landing screen depends on
    // session state and locale; assert only the invariant.
    expect(find.byType(WidgetsApp), findsOneWidget);
  });
}
