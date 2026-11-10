import 'package:core/core.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  tearDown(() => AppPalette.applyBrand());

  test('with no colour the platform palette stays', () {
    AppPalette.applyBrand();
    expect(AppPalette.navy, const Color(0xFF0F1E33));
    expect(AppPalette.gold400, const Color(0xFFC8A24B));
  });

  test("a company's colours become the navy and gold scales", () {
    AppPalette.applyBrand(primary: const Color(0xFF064E3B), accent: const Color(0xFFF5D76E));
    expect(AppPalette.navy, const Color(0xFF064E3B));
    expect(AppPalette.gold400, const Color(0xFFF5D76E));
    expect(AppPalette.navy700, isNot(AppPalette.navy));
    expect(AppPalette.gold50.computeLuminance(), greaterThan(AppPalette.gold600.computeLuminance()));
  });

  test('a light primary is darkened so white text reads on it', () {
    AppPalette.applyBrand(primary: const Color(0xFFFFFFFF));
    expect(AppPalette.navy.computeLuminance(), lessThan(0.19));
  });

  test('an accent that would vanish on the primary is lightened', () {
    AppPalette.applyBrand(primary: const Color(0xFF0F1E33), accent: const Color(0xFF0F1E34));
    expect(AppPalette.gold400.computeLuminance(), greaterThan(0.1));
  });

  test('clearing the brand restores the platform palette', () {
    AppPalette.applyBrand(primary: const Color(0xFF3730A3), accent: const Color(0xFFD97706));
    AppPalette.applyBrand();
    expect(AppPalette.navy, const Color(0xFF0F1E33));
  });

  // The customer app's headers and cards used fixed navy shades, so a company's
  // colour reached only some of them.
  test("every dark shade follows the company's primary and returns with no brand", () {
    List<Color> all() => [
          AppPalette.navyDeep, AppPalette.navyMid, AppPalette.navyLight, AppPalette.navyCard,
          AppPalette.navyDarkest, AppPalette.navyFoot, AppPalette.navyBright, AppPalette.navyMid2,
          AppPalette.navyPanel, AppPalette.navyHero, AppPalette.navyInk, AppPalette.navyTop,
          AppPalette.navyAccent, AppPalette.navyAccent2,
        ];
    AppPalette.applyBrand();
    final platform = all();
    expect(AppPalette.navyDeep, const Color(0xFF0B1726));
    expect(AppPalette.navyPanel, const Color(0xFF1A3352));
    AppPalette.applyBrand(primary: const Color(0xFF064E3B));
    final brand = all();
    for (var i = 0; i < brand.length; i++) {
      expect(brand[i], isNot(platform[i]), reason: 'shade $i stayed navy');
      // Green stays the dominant channel: it is the company's hue, not blue.
      expect((brand[i].g * 255).round(), greaterThan((brand[i].b * 255).round()));
    }
    AppPalette.applyBrand();
    expect(all(), platform);
  });

  // Dark-gold text, warm golds and browns followed a fixed gold, not the accent.
  test("every warm shade follows the company's accent and returns with no brand", () {
    List<Color> all() => [
          AppPalette.goldInk, AppPalette.goldWarm, AppPalette.goldWarm2, AppPalette.goldDeepA,
          AppPalette.goldDeepB, AppPalette.goldBrown1, AppPalette.goldBrown2, AppPalette.goldBrown3,
          AppPalette.goldBrown4, AppPalette.goldPale,
        ];
    AppPalette.applyBrand();
    final platform = all();
    expect(AppPalette.goldInk, const Color(0xFF9A6F1E));
    expect(AppPalette.goldPale, const Color(0xFFFBD27A));
    AppPalette.applyBrand(accent: const Color(0xFFEC4899));
    final brand = all();
    for (var i = 0; i < brand.length; i++) {
      expect(brand[i], isNot(platform[i]), reason: 'shade $i stayed gold');
      expect((brand[i].r * 255).round(), greaterThan((brand[i].g * 255).round()));
    }
    AppPalette.applyBrand();
    expect(all(), platform);
  });

  group('dark surfaces', () {
    double spread(Color c) {
      final v = [c.r, c.g, c.b]..sort();
      return (v.last - v.first) * 255;
    }

    double contrast(Color a, Color b) {
      final x = a.computeLuminance(), y = b.computeLuminance();
      return (x > y ? x + 0.05 : y + 0.05) / (x > y ? y + 0.05 : x + 0.05);
    }

    List<Color> surfaces() => [
          AppPalette.darkCanvas, AppPalette.darkSurface, AppPalette.darkSurfaceSoft, AppPalette.darkHairline,
        ];

    test("the platform's own tools keep the navy dark surfaces", () {
      AppPalette.applyBrand();
      expect(AppPalette.darkCanvas, const Color(0xFF0E1A2E));
      expect(AppPalette.darkSurface, const Color(0xFF1A2840));
    });

    test("a company's app gets neutral charcoal, whatever its colour", () {
      for (final primary in [const Color(0xFF166534), const Color(0xFF1D4ED8), const Color(0xFFB91C1C), null]) {
        AppPalette.applyBrand(primary: primary, neutralDark: true);
        for (final c in surfaces()) {
          expect(spread(c), lessThanOrEqualTo(10), reason: 'dark surface $c took a hue ($primary)');
        }
      }
    });

    test('the company colour stays on its scale, not in the dark surfaces', () {
      AppPalette.applyBrand(primary: const Color(0xFF166534), neutralDark: true);
      final green = surfaces();
      AppPalette.applyBrand(primary: const Color(0xFF1D4ED8), neutralDark: true);
      expect(surfaces(), green);
      expect(AppPalette.navy, isNot(green.first));
    });

    test('text stays readable on every neutral surface', () {
      AppPalette.applyBrand(neutralDark: true);
      for (final c in [AppPalette.darkCanvas, AppPalette.darkSurface, AppPalette.darkSurfaceSoft]) {
        expect(contrast(AppPalette.darkInk, c), greaterThanOrEqualTo(10));
        expect(contrast(AppPalette.darkInkMuted, c), greaterThanOrEqualTo(4.5));
      }
    });

    test('clearing the brand restores the navy', () {
      AppPalette.applyBrand(neutralDark: true);
      AppPalette.applyBrand();
      expect(AppPalette.darkCanvas, const Color(0xFF0E1A2E));
    });
  });
}
