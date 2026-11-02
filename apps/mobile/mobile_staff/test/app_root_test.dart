import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_staff/app.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The whole app, built from its real root as `bootstrap` does: catches a
/// widget above MaterialApp that reads something only MaterialApp provides
/// (the app used to open on a grey screen this way).
void main() {
  testWidgets('the staff app builds from its root and opens its first screen', (t) async {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    EnvConfig.initialize(EnvConfig.dev);

    final root = await buildAppRoot(env: EnvConfig.current, child: const StaffApp(), enableTenantSlugHeader: true);
    await t.pumpWidget(root);
    await t.pump(const Duration(seconds: 1));

    expect(t.takeException(), isNull);
    expect(find.byType(MaterialApp), findsOneWidget);

    // Leave no timers behind.
    await t.pumpWidget(const SizedBox.shrink());
    await t.pump(const Duration(seconds: 5));
  });
}
