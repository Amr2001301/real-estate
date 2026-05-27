import 'package:core/core.dart';
import 'package:flutter/widgets.dart';

import 'app.dart';

/// Shared startup used by every flavor entrypoint (main_dev/staging/prod).
/// Selects the environment, then delegates dependency + cubit wiring to the
/// shared `buildAppRoot` composition root in `core`.
Future<void> bootstrap(EnvConfig env) async {
  WidgetsFlutterBinding.ensureInitialized();
  EnvConfig.initialize(env);
  runApp(await buildAppRoot(env: EnvConfig.current, child: const CustomerApp()));
}
