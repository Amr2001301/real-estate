import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../auth/session_cubit.dart';
import '../auth/token_storage.dart';
import '../env/env_config.dart';
import '../l10n/locale_controller.dart';
import '../network/dio_client.dart';
import '../network/session_refresher_registry.dart';
import '../theme/theme_mode_controller.dart';

/// Composition root: builds the shared services (SharedPreferences, secure
/// TokenStorage, Dio) and app-wide cubits (Locale, Theme, Session), then wraps
/// [child] in the provider tree. Keeps `shared_preferences`/`dio` out of the
/// thin app packages — they only call this.
///
/// Services are exposed via `RepositoryProvider`; cubits via `BlocProvider`.
/// The [SessionRefresherRegistry] is provided so the app can wire the
/// 401→refresh handler once its auth repository exists.
Future<Widget> buildAppRoot({
  required EnvConfig env,
  required Widget child,
}) async {
  final prefs = await SharedPreferences.getInstance();
  final tokenStorage = TokenStorage();
  final refresherRegistry = SessionRefresherRegistry();

  final localeCubit = LocaleCubit(prefs);
  final themeCubit = ThemeCubit(prefs);

  final dio = DioClientFactory.create(
    env: env,
    tokenStorage: tokenStorage,
    readLocale: () => localeCubit.state.languageCode,
    refreshSession: refresherRegistry.call,
  );

  final sessionCubit = SessionCubit(tokenStorage)..restore();

  // Only truly-shared services live here. Feature repositories are wired by the
  // app at the feature-DI layer (see CustomerApp), keeping core feature-free.
  return MultiRepositoryProvider(
    providers: [
      RepositoryProvider<TokenStorage>.value(value: tokenStorage),
      RepositoryProvider<Dio>.value(value: dio),
      RepositoryProvider<SessionRefresherRegistry>.value(value: refresherRegistry),
    ],
    child: MultiBlocProvider(
      providers: [
        BlocProvider<LocaleCubit>.value(value: localeCubit),
        BlocProvider<ThemeCubit>.value(value: themeCubit),
        BlocProvider<SessionCubit>.value(value: sessionCubit),
      ],
      child: child,
    ),
  );
}
