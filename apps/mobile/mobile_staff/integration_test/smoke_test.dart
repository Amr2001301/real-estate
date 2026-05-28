// Phase 7A — Staff App integration smoke (LOCAL ONLY, not in CI).
//
// Boots the full Staff App via the dev entrypoint and confirms it
// settles to a first interactive surface (login screen for a
// not-yet-authenticated launch) without crashing. Heavier flows
// (login as sales → dashboard → leads, login as broker → portal) come
// in Phase 7B with an emulator harness and a backend running.
//
// Run locally on an attached device / emulator:
//
//   cd apps/mobile/mobile_staff
//   flutter test integration_test/smoke_test.dart

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_staff/main_dev.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Staff App boots without throwing and renders a first screen',
      (tester) async {
    app.main();

    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 2));

    expect(tester.takeException(), isNull);
    expect(find.byType(WidgetsApp), findsOneWidget);
  });
}
