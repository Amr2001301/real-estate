import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_customer/app.dart';
import 'package:mobile_customer/bootstrap.dart' show customerStartupOutcome;
import 'package:mobile_customer/startup/customer_startup_service.dart';
import 'package:mobile_customer/storage/customer_tenant_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The whole app, built from its real root as `bootstrap` does, with a
/// company already chosen: the home screen reads the catalog, whose
/// repository needs the chosen company (it used to open grey because that
/// provider was listed after the ones reading it).
void main() {
  testWidgets('the customer app builds from its root and opens the home screen', (t) async {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({
      CustomerTenantStorage.kSlugKey: 'acme',
      CustomerTenantStorage.kNameKey: 'Acme',
    });
    FlutterSecureStorage.setMockInitialValues({});
    EnvConfig.initialize(EnvConfig.dev);
    customerStartupOutcome.value = TenantStartupOutcome.valid;

    final root = await buildAppRoot(env: EnvConfig.current, child: const CustomerApp());
    await t.pumpWidget(root);
    for (var i = 0; i < 8; i++) {
      await t.pump(const Duration(milliseconds: 500));
    }

    expect(t.takeException(), isNull);
    expect(find.byType(MaterialApp), findsOneWidget);

    await t.pumpWidget(const SizedBox.shrink());
    await t.pump(const Duration(seconds: 5));
  });
}
