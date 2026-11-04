/// The company this build is locked to — set when the customer app is built
/// as one company's own store app (MA2):
///
///   flutter build appbundle --dart-define-from-file=build/company/dart_defines.json
///
/// (`tool/prepare_company_app.py` writes that file, with the app's name, icon
/// and package id.) Every customer app is one company's: a local build passes
/// `--dart-define=COMPANY_SLUG=default` (the dev seed's company), and the app
/// refuses to start without one — there is no company picker.
const String kLockedCompanySlug = String.fromEnvironment('COMPANY_SLUG');
const String kLockedCompanyName = String.fromEnvironment('COMPANY_NAME');

/// True in every runnable build; [bootstrap] refuses to start otherwise.
const bool kIsCompanyLocked = kLockedCompanySlug != '';
