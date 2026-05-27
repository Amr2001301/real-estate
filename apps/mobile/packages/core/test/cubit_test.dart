import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ThemeCubit', () {
    test('defaults to system and cycles + persists', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final cubit = ThemeCubit(prefs);

      expect(cubit.state, ThemeMode.system);
      await cubit.cycle();
      expect(cubit.state, ThemeMode.light);
      await cubit.cycle();
      expect(cubit.state, ThemeMode.dark);

      // Persisted: a fresh cubit restores the stored mode.
      expect(ThemeCubit(prefs).state, ThemeMode.dark);
    });
  });

  group('LocaleCubit', () {
    test('defaults to Arabic and toggles + persists', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final cubit = LocaleCubit(prefs);

      expect(cubit.state.languageCode, 'ar');
      expect(cubit.isRtl, isTrue);

      await cubit.toggle();
      expect(cubit.state.languageCode, 'en');
      expect(cubit.isRtl, isFalse);

      expect(LocaleCubit(prefs).state.languageCode, 'en');
    });
  });
}
