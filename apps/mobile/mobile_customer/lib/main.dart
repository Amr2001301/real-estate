import 'package:core/core.dart';

import 'bootstrap.dart';

/// Default entrypoint (delegates to dev) so a plain `flutter run` works.
/// Prefer the explicit flavor entrypoints: main_dev / main_staging / main_prod.
void main() => bootstrap(EnvConfig.dev);
