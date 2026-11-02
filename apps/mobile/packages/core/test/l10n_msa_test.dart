import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The owner chose Modern Standard Arabic (فصحى) for every text in both apps.
/// These Egyptian-dialect words should not come back into app_ar.arb.
const _dialect = [
  'ده', 'دي', 'دا', 'إيه', 'ايه', 'عشان', 'علشان', 'مش', 'كده', 'لسه',
  'دلوقتي', 'إزاي', 'ازاي', 'فين', 'إمتى', 'امتى', 'عايز', 'اللي', 'حاجة',
  'زي', 'ليه', 'مفيش', 'النهارده', 'بكرة', 'امبارح', 'تاني', 'اختار',
  'ضيف', 'بعدين', 'أكتر', 'ابعت', 'لينك', 'موبايل', 'موبايلك',
];

void main() {
  test('Arabic app text is in Modern Standard Arabic', () {
    final ar = jsonDecode(File('lib/src/l10n/arb/app_ar.arb').readAsStringSync()) as Map<String, dynamic>;
    final word = RegExp('(?<![؀-ۿ])(${_dialect.join('|')})(?![؀-ۿ])');
    final offenders = <String>[
      for (final e in ar.entries)
        if (!e.key.startsWith('@') && e.value is String && word.hasMatch(e.value as String)) '${e.key}: ${e.value}',
    ];
    expect(offenders, isEmpty, reason: 'Dialect wording in app_ar.arb:\n${offenders.join('\n')}');
  });
}
