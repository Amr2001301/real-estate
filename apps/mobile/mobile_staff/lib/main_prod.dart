import 'package:core/core.dart';

import 'bootstrap.dart';

/// Production entrypoint. Run with: flutter run -t lib/main_prod.dart --release
void main() => bootstrap(EnvConfig.prod);
