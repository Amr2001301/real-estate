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

  /// Compact form for dense, multi-column layouts (e.g. the compare matrix):
  /// "1.6M EGP" / "١٫٦M ج.م", "750K EGP" / "٧٥٠K ج.م". Keeps localized digits
  /// and the currency suffix; falls back to the full grouped form below 1,000.
  static String formatCompact(num? value, {required String languageCode}) {
    if (value == null) return '';
    final locale = languageCode == 'ar' ? 'ar_EG' : 'en_US';
    final currency = languageCode == 'ar' ? 'ج.م' : 'EGP';
    final fmt = NumberFormat('#,##0.#', locale);
    final v = value.toDouble();
    if (v >= 1000000) return '${fmt.format(v / 1000000)}M $currency';
    if (v >= 1000) return '${fmt.format(v / 1000)}K $currency';
    return '${fmt.format(v)} $currency';
  }

  static String formatCompactString(String? raw,
          {required String languageCode}) =>
      formatCompact(num.tryParse(raw ?? ''), languageCode: languageCode);
}
