import 'package:intl/intl.dart';

/// Locale-aware date formatting: Arabic month names, Western digits
/// ("1 نوفمبر 2026"), as on the dashboard and the website. Pure Dart utility
/// (presentation concern).
abstract final class DateFormatter {
  static String mediumDate(DateTime date, {required String languageCode}) =>
      _western(DateFormat.yMMMMd(_locale(languageCode))).format(date);

  static String shortDate(DateTime date, {required String languageCode}) =>
      _western(DateFormat.yMMMd(_locale(languageCode))).format(date);

  /// Day and month only ("2 نوفمبر", "Nov 2").
  static String dayMonth(DateTime date, {required String languageCode}) =>
      _western(languageCode == 'ar' ? DateFormat('d MMMM', 'ar') : DateFormat('MMM d', 'en')).format(date);

  /// Month and year only ("نوفمبر 2026", "November 2026").
  static String monthYear(DateTime date, {required String languageCode}) =>
      _western(DateFormat.yMMMM(_locale(languageCode))).format(date);

  /// Short weekday ("السبت", "Sat").
  static String weekdayShort(DateTime date, {required String languageCode}) =>
      _western(languageCode == 'ar' ? DateFormat('EEEE', 'ar') : DateFormat('EEE', 'en')).format(date);

  /// Short month ("نوفمبر", "Nov").
  static String monthShort(DateTime date, {required String languageCode}) =>
      _western(languageCode == 'ar' ? DateFormat('MMMM', 'ar') : DateFormat('MMM', 'en')).format(date);

  static String _locale(String languageCode) => languageCode == 'ar' ? 'ar' : 'en';

  static DateFormat _western(DateFormat f) => f..useNativeDigits = false;
}
