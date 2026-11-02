import 'package:intl/intl.dart';

/// Locale-aware date formatting: Arabic month names, Western digits
/// ("1 نوفمبر 2026"), as on the dashboard and the website. Pure Dart utility
/// (presentation concern).
abstract final class DateFormatter {
  static String mediumDate(DateTime date, {required String languageCode}) =>
      _western(DateFormat.yMMMMd(_locale(languageCode))).format(date);

  static String shortDate(DateTime date, {required String languageCode}) =>
      _western(DateFormat.yMMMd(_locale(languageCode))).format(date);

  static String _locale(String languageCode) => languageCode == 'ar' ? 'ar' : 'en';

  static DateFormat _western(DateFormat f) => f..useNativeDigits = false;
}
