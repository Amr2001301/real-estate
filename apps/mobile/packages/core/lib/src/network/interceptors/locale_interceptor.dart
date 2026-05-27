import 'package:dio/dio.dart';

/// Returns the active language code (`ar` / `en`).
typedef LocaleReader = String Function();

/// Sends the active locale on every request so the backend can localize
/// responses (chat greetings, validation messages, etc.).
class LocaleInterceptor extends Interceptor {
  LocaleInterceptor(this._readLocale);

  final LocaleReader _readLocale;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final code = _readLocale();
    options.headers['Accept-Language'] = code;
    // App-specific hint mirrored from the chat contract's `locale` field.
    options.headers.putIfAbsent('X-App-Locale', () => code);
    handler.next(options);
  }
}
