import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Translatable', () {
    test('resolves by language with fallback', () {
      const t = Translatable(ar: 'مشروع', en: 'Project');
      expect(t.resolve('ar'), 'مشروع');
      expect(t.resolve('en'), 'Project');
      expect(
        const Translatable(ar: '', en: 'Only EN').resolve('ar'),
        'Only EN',
      );
    });

    group('fromJson (tolerant: Map | String | null)', () {
      test('parses an { ar, en } map', () {
        final t = Translatable.fromJson({'ar': ' مشروع ', 'en': ' Project '});
        expect(t.ar, 'مشروع'); // trimmed
        expect(t.en, 'Project');
      });

      test('parses a flattened localized string into both sides', () {
        // The backend locale interceptor flattens `{ar,en}` → a localized
        // string when Accept-Language is sent. Regression for the mobile crash
        // "String is not a subtype of Map<String, dynamic>?".
        final t = Translatable.fromJson('سولارا هايتس');
        expect(t.ar, 'سولارا هايتس');
        expect(t.en, 'سولارا هايتس');
        expect(t.resolve('en'), 'سولارا هايتس');
      });

      test('null / non-string / non-map → empty', () {
        expect(Translatable.fromJson(null).isEmpty, isTrue);
        expect(Translatable.fromJson(42).isEmpty, isTrue);
      });
    });
  });

  group('Paginated', () {
    test('parses + maps items, preserving meta', () {
      final page = Paginated.fromJson({
        'data': [
          {'v': 1},
          {'v': 2},
        ],
        'meta': {'page': 1, 'pageSize': 20, 'total': 40, 'totalPages': 2},
      }, (j) => j['v'] as int);
      expect(page.data, [1, 2]);
      expect(page.hasMore, isTrue);
      final mapped = page.map((v) => v * 10);
      expect(mapped.data, [10, 20]);
      expect(mapped.meta.total, 40);
    });
  });

  group('PriceFormatter', () {
    test('formats English with grouping + currency', () {
      final s = PriceFormatter.format(5800000, languageCode: 'en');
      expect(s, contains('5,800,000'));
      expect(s, contains('EGP'));
    });

    test('formats Arabic with currency suffix', () {
      expect(
        PriceFormatter.format(5800000, languageCode: 'ar'),
        contains('ج.م'),
      );
    });

    test('null price → empty string', () {
      expect(PriceFormatter.format(null, languageCode: 'en'), '');
    });
  });
}
