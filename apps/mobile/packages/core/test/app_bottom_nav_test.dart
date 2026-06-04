import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Widget host(Widget nav) => MaterialApp(
        theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
        home: Scaffold(bottomNavigationBar: nav, body: const SizedBox.expand()),
      );

  const items = [
    AppBottomNavItem(icon: Icons.home_rounded, label: 'Home'),
    AppBottomNavItem(icon: Icons.apartment_rounded, label: 'Property'),
    AppBottomNavItem(icon: Icons.account_balance_wallet_rounded, label: 'Finance'),
    AppBottomNavItem(icon: Icons.build_rounded, label: 'Maintenance'),
    AppBottomNavItem(icon: Icons.person_rounded, label: 'Account'),
  ];

  testWidgets('renders all 5 destinations', (tester) async {
    await tester.pumpWidget(host(
      AppBottomNav(items: items, currentIndex: 0, onSelect: (_) {}),
    ));

    for (final it in items) {
      expect(find.text(it.label), findsOneWidget);
    }
  });

  testWidgets('reports the tapped destination index', (tester) async {
    final taps = <int>[];
    await tester.pumpWidget(host(
      AppBottomNav(items: items, currentIndex: 0, onSelect: taps.add),
    ));

    await tester.tap(find.text('Finance'));
    await tester.tap(find.text('Account'));

    expect(taps, [2, 4]);
  });

  testWidgets('Material style uses ink-rippled items (Android feel)',
      (tester) async {
    await tester.pumpWidget(host(
      AppBottomNav(
        items: items,
        currentIndex: 0,
        onSelect: (_) {},
        style: AppBottomNavStyle.material,
      ),
    ));
    expect(find.byType(InkResponse), findsWidgets);
  });

  testWidgets('Cupertino style drops the ink ripple (iOS feel)',
      (tester) async {
    await tester.pumpWidget(host(
      AppBottomNav(
        items: items,
        currentIndex: 0,
        onSelect: (_) {},
        style: AppBottomNavStyle.cupertino,
      ),
    ));
    expect(find.byType(InkResponse), findsNothing);
    // All destinations still render.
    for (final it in items) {
      expect(find.text(it.label), findsOneWidget);
    }
  });

  testWidgets('marks the current destination as selected', (tester) async {
    await tester.pumpWidget(host(
      AppBottomNav(items: items, currentIndex: 3, onSelect: (_) {}),
    ));

    // Exactly one destination carries selected=true, and it's 'Maintenance'.
    expect(
      find.byWidgetPredicate(
        (w) => w is Semantics && w.properties.selected == true,
      ),
      findsOneWidget,
    );
    expect(
      find.byWidgetPredicate(
        (w) =>
            w is Semantics &&
            w.properties.selected == true &&
            w.properties.label == 'Maintenance',
      ),
      findsOneWidget,
    );
  });
}
