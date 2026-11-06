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
}
