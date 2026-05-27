import 'package:intl/intl.dart';

/// Formats prices for display. The backend returns raw decimal strings; we add
/// grouping and a localized currency suffix (e.g. "5,800,000 EGP" /
/// "٥٬٨٠٠٬٠٠٠ ج.م"). Pure Dart utility (presentation concern, not domain).
abstract final class PriceFormatter {
  static String format(num? value, {required String languageCode}) {
    if (value == null) return '';
    final locale = languageCode == 'ar' ? 'ar_EG' : 'en_US';
    final number = NumberFormat.decimalPattern(locale).format(value);
    final currency = languageCode == 'ar' ? 'ج.م' : 'EGP';
    return '$number $currency';
  }

  static String formatString(String? raw, {required String languageCode}) =>
      format(num.tryParse(raw ?? ''), languageCode: languageCode);
}
