import 'package:core/core.dart';

import 'bootstrap.dart';

/// Production entrypoint — a company's own store app. Built by the
/// company-app workflow (or `tool/prepare_company_app.py`), which sets
/// COMPANY_SLUG and COMPANY_NAME:
///
///   flutter build appbundle --release -t lib/main_prod.dart \
///     --dart-define-from-file=build/company/dart_defines.json
///
/// [bootstrap] refuses to start a build without its company.
void main() => bootstrap(EnvConfig.prod);
