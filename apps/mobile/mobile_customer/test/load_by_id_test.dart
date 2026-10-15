import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/router/load_by_id.dart';

void main() {
  testWidgets('a detail screen opened from an id alone finds its item', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LoadById<String>(
          load: () async => const Ok(['contract-a', 'contract-b']),
          matches: (item) => item == 'contract-b',
          builder: (item) => Text('detail $item'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('detail contract-b'), findsOneWidget);
  });
}
