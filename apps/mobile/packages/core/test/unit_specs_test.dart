import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// EE2 / EE5 in the apps: a unit's specs, shown as on the website.
void main() {
  test('reads only the specs a unit has', () {
    final s = UnitSpecs.fromJson({
      'netArea': 120.5,
      'gardenArea': 0,
      'roofArea': null,
      'terraceArea': '24',
      'finishing': 'SEMI_FINISHED',
      'view': '',
      'orientation': 'NORTH_EAST',
      'deliveryDate': '2027-06-30',
    });
    expect(s.netArea, 120.5);
    expect(s.gardenArea, isNull);
    expect(s.terraceArea, 24);
    expect(s.view, isNull);
    expect(s.deliveryDate, DateTime.utc(2027, 6, 30));
    expect(s.isEmpty, isFalse);
    expect(UnitSpecs.fromJson(const {}).isEmpty, isTrue);
  });

  test('the staff unit carries the handover as effectiveDeliveryDate', () {
    final s = UnitSpecs.fromJson(
      {'deliveryDate': null, 'effectiveDeliveryDate': '2026-12-01T00:00:00.000Z'},
      deliveryKey: 'effectiveDeliveryDate',
    );
    expect(s.deliveryDate, DateTime.utc(2026, 12, 1));
  });

  testWidgets('labels in Arabic, in the website order; handover month or «استلام فوري»', (t) async {
    late List<UnitSpecItem> items;
    late List<UnitSpecItem> due;
    await t.pumpWidget(MaterialApp(
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(builder: (context) {
        final l10n = AppLocalizations.of(context);
        items = unitSpecItems(
          const UnitSpecs(netArea: 120, gardenArea: 55.5, finishing: 'FULLY_FINISHED', view: 'NILE', orientation: 'SOUTH'),
          l10n,
          'ar',
        );
        due = unitSpecItems(UnitSpecs(deliveryDate: DateTime.utc(2027, 6, 30)), l10n, 'ar', now: DateTime(2026, 11, 1));
        due += unitSpecItems(UnitSpecs(deliveryDate: DateTime.utc(2026, 10, 1)), l10n, 'ar', now: DateTime(2026, 11, 1));
        return const SizedBox();
      }),
    ));
    expect(items.map((i) => '${i.label}: ${i.value}'), [
      'المساحة الصافية: 120 م²',
      'الحديقة: 55.5 م²',
      'التشطيب: تشطيب كامل',
      'الإطلالة: النيل',
      'الاتجاه: قبلي',
    ]);
    expect(due.map((i) => i.value), ['يونيو 2027', 'استلام فوري']);
  });

  testWidgets('the grid shows nothing for a unit without specs', (t) async {
    Future<void> pump(UnitSpecs s) => t.pumpWidget(MaterialApp(
          theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: UnitSpecsGrid(specs: s)),
        ));
    await pump(const UnitSpecs());
    expect(find.byKey(const Key('unit-specs')), findsNothing);
    await pump(const UnitSpecs(finishing: 'FURNISHED', view: 'SEA'));
    expect(find.text('Furnished'), findsOneWidget);
    expect(find.text('Sea'), findsOneWidget);
  });
}
