/// The company this build is locked to — set when the customer app is built
/// as one company's own store app (MA2):
///
///   flutter build appbundle --dart-define-from-file=build/company/dart_defines.json
///
/// (`tool/prepare_company_app.py` writes that file, with the app's name, icon
/// and package id.) Empty in the shared app, where the customer picks a
/// company on first launch.
const String kLockedCompanySlug = String.fromEnvironment('COMPANY_SLUG');
const String kLockedCompanyName = String.fromEnvironment('COMPANY_NAME');

/// True in a company's own app: the company picker never shows and the
/// selection cannot be cleared.
const bool kIsCompanyLocked = kLockedCompanySlug != '';
