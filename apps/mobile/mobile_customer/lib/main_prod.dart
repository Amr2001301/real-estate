import 'package:core/core.dart';

import 'bootstrap.dart';
import 'company_lock.dart';

/// Production entrypoint — a company's own store app. Built by the
/// company-app workflow (or `tool/prepare_company_app.py`), which sets
/// COMPANY_SLUG and COMPANY_NAME:
///
///   flutter build appbundle --release -t lib/main_prod.dart \
///     --dart-define-from-file=build/company/dart_defines.json
///
/// Every customer app is one company's: a store build without a company
/// would open on the company picker, so it refuses to start instead.
void main() {
  if (!kIsCompanyLocked) {
    throw StateError(
      'This production build has no company. Build it with '
      '--dart-define-from-file=build/company/dart_defines.json '
      '(see tool/prepare_company_app.py).',
    );
  }
  bootstrap(EnvConfig.prod);
}
