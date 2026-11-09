import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/info_request/presentation/screens/info_request_screen.dart';
import 'package:mobile_customer/features/maintenance/presentation/create_maintenance_screen.dart';

/// The request forms: a visit picks a day and a time freely, a question can be
/// topics alone, and each maintenance category gets its own icon.
void main() {
  testWidgets(
    'a question sends the ticked topics on their own line, then the text',
    (t) async {
      late AppLocalizations l10n;
      await t.pumpWidget(
        Localizations(
          locale: const Locale('ar'),
          delegates: AppLocalizations.localizationsDelegates,
          child: Builder(
            builder: (context) {
              l10n = AppLocalizations.of(context);
              return const SizedBox();
            },
          ),
        ),
      );
      expect(
        infoRequestMessage(l10n, [
          InfoTopic.prices,
          InfoTopic.delivery,
        ], '  هل يوجد خصم للكاش؟ '),
        'المواضيع: الأسعار وخطط السداد، موعد التسليم\nهل يوجد خصم للكاش؟',
      );
      expect(infoRequestMessage(l10n, const [], 'سؤال'), 'سؤال');
      expect(
        infoRequestMessage(l10n, [InfoTopic.areas], ''),
        'المواضيع: المساحات المتاحة',
      );
    },
  );

  test('maintenance categories get an icon from their name', () {
    expect(maintenanceCategoryIcon('سباكة Plumbing'), Icons.plumbing_rounded);
    expect(
      maintenanceCategoryIcon('كهرباء Electricity'),
      Icons.electrical_services_rounded,
    );
    expect(
      maintenanceCategoryIcon('تكييف Air conditioning'),
      Icons.ac_unit_rounded,
    );
    expect(
      maintenanceCategoryIcon('أعمال عامة General works'),
      Icons.handyman_rounded,
    );
  });
}
