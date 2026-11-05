import 'package:core/core.dart';

/// A period «2026-11» as «نوفمبر 2026» (the raw text when it is not one).
String periodLabel(String period, String languageCode) {
  final m = RegExp(r'^(\d{4})-(\d{2})$').firstMatch(period);
  if (m == null) return period;
  return DateFormatter.monthYear(DateTime(int.parse(m.group(1)!), int.parse(m.group(2)!)), languageCode: languageCode);
}

String currentPeriod() {
  final n = DateTime.now();
  return '${n.year}-${n.month.toString().padLeft(2, '0')}';
}
