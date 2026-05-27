import 'package:core/core.dart';

import 'bootstrap.dart';

/// Default entrypoint (delegates to dev). Prefer main_dev / main_staging /
/// main_prod for explicit flavor selection.
void main() => bootstrap(EnvConfig.dev);
