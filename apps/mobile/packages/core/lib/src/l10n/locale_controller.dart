import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Locales the apps support. Arabic is primary (matches the platform & chat).
const List<Locale> kSupportedLocales = [Locale('ar'), Locale('en')];

const String _localePrefKey = 'app.locale';

/// Simple persisted locale state → a Cubit. Changing the locale rebuilds
/// `MaterialApp`, which re-resolves the body font (Inter vs IBM Plex Sans
/// Arabic) and the text direction (LTR vs RTL).
class LocaleCubit extends Cubit<Locale> {
  LocaleCubit(this._prefs) : super(_read(_prefs));

  final SharedPreferences _prefs;

  static Locale _read(SharedPreferences prefs) =>
      prefs.getString(_localePrefKey) == 'en'
          ? const Locale('en')
          : const Locale('ar');

  bool get isRtl => state.languageCode == 'ar';

  Future<void> setLocale(Locale locale) async {
    if (!kSupportedLocales.any((l) => l.languageCode == locale.languageCode)) {
      return;
    }
    emit(Locale(locale.languageCode));
    await _prefs.setString(_localePrefKey, locale.languageCode);
  }

  /// Flip between Arabic and English (used by the gallery toggle).
  Future<void> toggle() => setLocale(
        state.languageCode == 'ar' ? const Locale('en') : const Locale('ar'),
      );
}
