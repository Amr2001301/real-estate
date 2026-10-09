import 'package:intl/intl.dart';

/// Formats prices for display. The backend returns raw decimal strings; we add
/// grouping and the company currency as a localized suffix (e.g.
/// "5,800,000 EGP" / "٥٬٨٠٠٬٠٠٠ ج.م"). Pure Dart utility (presentation
/// concern, not domain).
///
/// The currency is the company's (`Company.currency`, picked by the admin on
/// the dashboard branding page). The app sets it once it knows the tenant —
/// the customer app from the public branding, the staff app from
/// `GET /company/currency` — via [currencyCode]. Until then it is EGP.
abstract final class PriceFormatter {
  static const String defaultCurrency = 'EGP';

  /// Short Arabic symbols, matching the API and the web apps.
  static const Map<String, String> _arabicSymbols = {
    'EGP': 'ج.م',
    'SAR': 'ر.س',
    'AED': 'د.إ',
    'KWD': 'د.ك',
    'QAR': 'ر.ق',
    'BHD': 'د.ب',
    'OMR': 'ر.ع',
    'JOD': 'د.أ',
    'USD': r'$',
  };

  static String _currency = defaultCurrency;

  /// The active company currency (ISO 4217).
  static String get currencyCode => _currency;

  /// Sets the company currency; null, empty or unsupported codes fall back to
  /// [defaultCurrency].
  static set currencyCode(String? code) => _currency = normalize(code);

  /// Upper-cased supported code, else [defaultCurrency].
  static String normalize(String? code) {
    final c = (code ?? '').trim().toUpperCase();
    return _arabicSymbols.containsKey(c) ? c : defaultCurrency;
  }

  /// The suffix shown after amounts: the Arabic symbol in Arabic, the ISO code
  /// otherwise. [currency] overrides the company currency.
  static String symbol(String languageCode, [String? currency]) {
    final code = currency == null ? _currency : normalize(currency);
    return languageCode == 'ar' ? _arabicSymbols[code]! : code;
  }

  static String format(num? value,
      {required String languageCode, String? currency}) {
    if (value == null) return '';
    final locale = languageCode == 'ar' ? 'ar_EG' : 'en_US';
    final number = NumberFormat.decimalPattern(locale).format(value);
    return '$number ${symbol(languageCode, currency)}';
  }

  static String formatString(String? raw,
          {required String languageCode, String? currency}) =>
      format(num.tryParse(raw ?? ''),
          languageCode: languageCode, currency: currency);

  /// Compact form for dense, multi-column layouts (e.g. the compare matrix):
  /// "1.6M EGP" / "١٫٦M ج.م", "750K EGP" / "٧٥٠K ج.م". Keeps localized digits
  /// and the currency suffix; falls back to the full grouped form below 1,000.
  static String formatCompact(num? value, {required String languageCode}) {
    if (value == null) return '';
    final locale = languageCode == 'ar' ? 'ar_EG' : 'en_US';
    final currency = symbol(languageCode);
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
