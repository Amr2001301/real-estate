import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/shell/presentation/customer_shell_scaffold.dart';
import 'package:mobile_customer/features/shell/presentation/notification_bell.dart';

/// The bottom-nav / tab-routing behavior is covered by the core
/// `AppBottomNav` test; here we verify the customer-side notification bell
/// badge, which surfaces the app-wide unread count in the shell header.
void main() {
  group('shellBranchOrder (guest vs authenticated nav)', () {
    // Branch indices (see customer_shell_scaffold.dart): 0 home, 1 projects,
    // 2 units, 3 compare, 4 more, 5 property, 6 finance, 7 maintenance,
    // 8 account.
    const accountBranches = {5, 6, 7, 8};

    test('guest sees five public browsing tabs (no account tabs)', () {
      final order = shellBranchOrder(isCustomer: false);
      expect(order, [0, 1, 2, 3, 4]); // home, projects, units, compare, more
      expect(order.length, 5); // no longer the weak 3-tab bar
      expect(order.toSet().intersection(accountBranches), isEmpty);
    });

    test('authenticated customer sees the customer tab set', () {
      final order = shellBranchOrder(isCustomer: true);
      expect(order, [0, 5, 6, 7, 8]); // home, property, finance, maintenance, account
      // Guest-only browsing branches (projects/units/compare/more) are absent.
      expect(order.toSet().intersection({1, 2, 3, 4}), isEmpty);
    });
  });

  Widget host(Widget child) => MaterialApp(
        theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
        home: Scaffold(appBar: AppBar(actions: [child])),
      );

  testWidgets('shows a badge with the count when unread > 0', (tester) async {
    await tester.pumpWidget(host(NotificationBell(count: 3, onTap: () {})));
    expect(find.text('3'), findsOneWidget);
  });

  testWidgets('caps the badge at 9+', (tester) async {
    await tester.pumpWidget(host(NotificationBell(count: 25, onTap: () {})));
    expect(find.text('9+'), findsOneWidget);
  });

  testWidgets('hides the badge when there are no unread', (tester) async {
    await tester.pumpWidget(host(NotificationBell(count: 0, onTap: () {})));
    expect(find.text('0'), findsNothing);
  });

  testWidgets('reports taps', (tester) async {
    var tapped = false;
    await tester.pumpWidget(host(NotificationBell(count: 1, onTap: () => tapped = true)));
    await tester.tap(find.byType(NotificationBell));
    expect(tapped, isTrue);
  });
}
