import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/installments/domain/entities/installment.dart';
import 'package:mobile_customer/features/installments/presentation/widgets/installment_card.dart';

/// One installment card for «أقساطي» and a property's installments tab:
/// same submit label, and it follows the dark theme (no fixed white card).

Installment _inst({
  InstallmentStatus status = InstallmentStatus.pending,
  PaymentProofSummary? proof,
}) =>
    Installment(
      id: 'i1',
      amount: '1250000.00',
      dueDate: DateTime(2026, 12, 1),
      status: status,
      type: InstallmentPaymentType.installment,
      latestProof: proof,
    );

Future<void> _pump(WidgetTester tester, Installment inst, Brightness b) async {
  await tester.pumpWidget(MaterialApp(
    theme: ThemeData(brightness: b, extensions: [AppColorsExt.resolve(b)]),
    locale: const Locale('ar'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(body: SingleChildScrollView(child: InstallmentCard(installment: inst))),
  ));
  await tester.pump();
}

void main() {
  testWidgets('an unpaid installment offers «إرسال إثبات الدفع»', (tester) async {
    await _pump(tester, _inst(), Brightness.light);
    expect(find.text('إرسال إثبات الدفع'), findsOneWidget);
    expect(find.text('إرسال إيصال الدفع'), findsNothing);
  });

  testWidgets('a rejected proof offers the resubmit action', (tester) async {
    await _pump(
      tester,
      _inst(
        proof: const PaymentProofSummary(
          depositId: 'd1',
          reviewStatus: PaymentProofStatus.rejected,
          rejectionReason: 'الصورة غير واضحة',
        ),
      ),
      Brightness.light,
    );
    expect(find.text('إعادة إرسال إثبات الدفع'), findsOneWidget);
  });

  testWidgets('the card uses the theme surface in dark mode', (tester) async {
    await _pump(tester, _inst(), Brightness.dark);
    final surface = AppColorsExt.resolve(Brightness.dark).surface;
    final boxes = tester
        .widgetList<Container>(find.descendant(
          of: find.byType(InstallmentCard),
          matching: find.byType(Container),
        ))
        .map((c) => c.decoration)
        .whereType<BoxDecoration>();
    expect(boxes.first.color, surface);
    expect(boxes.any((d) => d.color == Colors.white), isFalse);
  });
}
