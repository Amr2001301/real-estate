import 'package:intl/intl.dart';

/// Locale-aware date formatting. Pure Dart utility (presentation concern).
abstract final class DateFormatter {
  static String mediumDate(DateTime date, {required String languageCode}) {
    final locale = languageCode == 'ar' ? 'ar' : 'en';
    return DateFormat.yMMMMd(locale).format(date);
  }

  static String shortDate(DateTime date, {required String languageCode}) {
    final locale = languageCode == 'ar' ? 'ar' : 'en';
    return DateFormat.yMMMd(locale).format(date);
  }
}
