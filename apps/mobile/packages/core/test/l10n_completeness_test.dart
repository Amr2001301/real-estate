import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Guards localization completeness: the Arabic and English ARB files must
/// define exactly the same set of message keys (ignoring `@`-metadata and the
/// `@@locale` header). Catches any key added to one language but not the other.
void main() {
  Set<String> keysOf(String path) {
    final json = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
    return json.keys.where((k) => !k.startsWith('@')).toSet();
  }

  test('app_ar.arb and app_en.arb define the same message keys', () {
    final en = keysOf('lib/src/l10n/arb/app_en.arb');
    final ar = keysOf('lib/src/l10n/arb/app_ar.arb');

    final missingInAr = en.difference(ar);
    final missingInEn = ar.difference(en);

    expect(missingInAr, isEmpty, reason: 'Keys missing from Arabic: $missingInAr');
    expect(missingInEn, isEmpty, reason: 'Keys missing from English: $missingInEn');
  });

  test('placeholder ARB metadata stays in sync for parameterized keys', () {
    final enJson = jsonDecode(File('lib/src/l10n/arb/app_en.arb').readAsStringSync()) as Map<String, dynamic>;
    final arJson = jsonDecode(File('lib/src/l10n/arb/app_ar.arb').readAsStringSync()) as Map<String, dynamic>;
    // Only `@`-entries that actually carry `placeholders` need to mirror in AR.
    // Description-only metadata (e.g. `@customerAppTitle: {description: ...}`)
    // is allowed to live in EN alone — codegen reads it from one locale.
    final enPlaceholderKeys = enJson.entries
        .where((e) =>
            e.key.startsWith('@') &&
            e.key != '@@locale' &&
            e.value is Map &&
            (e.value as Map).containsKey('placeholders'))
        .map((e) => e.key);
    for (final k in enPlaceholderKeys) {
      expect(arJson.containsKey(k), isTrue, reason: 'AR missing placeholder metadata for $k');
    }
  });
}
