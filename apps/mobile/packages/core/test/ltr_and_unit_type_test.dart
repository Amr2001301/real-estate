import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  setUpAll(() => initializeDateFormatting('ar'));

  test('ltr isolates a phone or a code inside Arabic text', () {
    expect(ltr('+201009900084'), '\u2066+201009900084\u2069');
    expect(ltr('#CON-2026-0005'), '\u2066#CON-2026-0005\u2069');
    expect(ltr(null), '');
    expect(ltr(''), '');
  });

  test('a unit type reads as its name, never its code', () {
    expect(unitTypeLabel('Villa', languageCode: 'ar'), 'فيلا');
    expect(unitTypeLabel('2BR', languageCode: 'ar'), 'شقة بغرفتي نوم');
    expect(unitTypeLabel('2BR', languageCode: 'en'), '2-bedroom apartment');
    expect(unitTypeLabel('shop', languageCode: 'ar'), 'محل تجاري');
    // The company's own name wins.
    expect(
      unitTypeLabel('Villa', languageCode: 'ar', name: {'ar': 'فيلا مستقلة', 'en': 'Standalone villa'}),
      'فيلا مستقلة',
    );
    expect(
      unitTypeLabel(
        'Villa',
        languageCode: 'en',
        name: const Translatable(ar: 'فيلا مستقلة', en: 'Standalone villa'),
      ),
      'Standalone villa',
    );
    // A company's own code with no name shows as it is.
    expect(unitTypeLabel('Loft-A', languageCode: 'ar'), 'Loft-A');
    expect(unitTypeLabel(null, languageCode: 'ar'), '');
  });

  test('amounts and dates use Western digits in Arabic too', () {
    expect(PriceFormatter.format(5800000, languageCode: 'ar'), '5,800,000 ج.م');
    expect(PriceFormatter.formatCompact(1600000, languageCode: 'ar'), '1.6M ج.م');
    expect(DateFormatter.mediumDate(DateTime(2026, 11, 1), languageCode: 'ar'), '1 نوفمبر 2026');
  });

  test('ltrRuns isolates Latin codes inside Arabic text, leaves numbers alone', () {
    expect(
      ltrRuns('خطة 5 سنوات — DF-LB-Z01-302'),
      'خطة 5 سنوات — \u2066DF-LB-Z01-302\u2069',
    );
    expect(ltrRuns('عقد #CON-2026-0005'), 'عقد \u2066#CON-2026-0005\u2069');
    expect(ltrRuns('خطة 5 سنوات'), 'خطة 5 سنوات');
    expect(ltrRuns(null), '');
  });
}
