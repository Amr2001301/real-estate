import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../auth/session_cubit.dart';
import '../auth/token_storage.dart';
import '../env/env_config.dart';
import '../l10n/locale_controller.dart';
import '../network/dio_client.dart';
import '../network/interceptors/tenant_slug_interceptor.dart';
import '../network/session_refresher_registry.dart';
import '../network/tenant_mismatch_registry.dart';
import '../theme/theme_mode_controller.dart';

/// Composition root: builds the shared services (SharedPreferences, secure
/// TokenStorage, Dio) and app-wide cubits (Locale, Theme, Session), then wraps
/// [child] in the provider tree. Keeps `shared_preferences`/`dio` out of the
/// thin app packages — they only call this.
///
/// Services are exposed via `RepositoryProvider`; cubits via `BlocProvider`.
/// The [SessionRefresherRegistry] is provided so the app can wire the
/// 401→refresh handler once its auth repository exists.
///
/// [sessionRestoreCheck]: optional extra predicate passed to
/// [SessionCubit.restore]. The staff app supplies a check that the selected
/// company slug is present; customer app omits this.
///
/// [readTenantSlug]: when non-null, [DioClientFactory] adds a
/// [TenantSlugInterceptor] that injects `X-Tenant-Slug` on authenticated
/// requests. Staff app uses [enableTenantSlugHeader] = true (reads from
/// TokenStorage). Customer app passes [readTenantSlug] directly so it can
/// supply its own storage reader (SharedPreferences key) without changing
/// the staff call-site.
Future<Widget> buildAppRoot({
  required EnvConfig env,
  required Widget child,
  Future<bool?> Function(TokenStorage storage)? sessionRestoreCheck,
  /// When true, a [TenantSlugInterceptor] is added using
  /// `tokenStorage.readSelectedCompanySlug` as the reader. Staff app uses
  /// this. Ignored when [readTenantSlug] is non-null.
  bool enableTenantSlugHeader = false,
  /// Direct slug reader for apps that source the slug outside of
  /// [TokenStorage] (e.g., the customer app reads from SharedPreferences).
  /// Takes precedence over [enableTenantSlugHeader].
  TenantSlugReader? readTenantSlug,
}) async {
  final prefs = await SharedPreferences.getInstance();
  final tokenStorage = TokenStorage();
  final refresherRegistry = SessionRefresherRegistry();
  final mismatchRegistry = TenantMismatchRegistry();

  final localeCubit = LocaleCubit(prefs);
  final themeCubit = ThemeCubit(prefs);

  // Resolve the effective slug reader once — used both to determine which
  // reader is active and to guard the onTenantMismatch wiring.
  final effectiveSlugReader = readTenantSlug ??
      (enableTenantSlugHeader ? tokenStorage.readSelectedCompanySlug : null);

  final dio = DioClientFactory.create(
    env: env,
    tokenStorage: tokenStorage,
    readLocale: () => localeCubit.state.languageCode,
    refreshSession: refresherRegistry.call,
    readTenantSlug: effectiveSlugReader,
    // Wire the mismatch handler whenever the slug interceptor is active,
    // regardless of which app (staff or customer) activated it. The registry
    // delegates to whichever handler the app root wires after build.
    onTenantMismatch: effectiveSlugReader != null ? mismatchRegistry.call : null,
  );

  final sessionCubit = SessionCubit(tokenStorage)
    ..restore(
      additionalCheck: sessionRestoreCheck != null
          ? () => sessionRestoreCheck(tokenStorage)
          : null,
    );

  // Only truly-shared services live here. Feature repositories are wired by the
  // app at the feature-DI layer (see CustomerApp), keeping core feature-free.
  return MultiRepositoryProvider(
    providers: [
      RepositoryProvider<SharedPreferences>.value(value: prefs),
      RepositoryProvider<TokenStorage>.value(value: tokenStorage),
      RepositoryProvider<Dio>.value(value: dio),
      RepositoryProvider<SessionRefresherRegistry>.value(value: refresherRegistry),
      RepositoryProvider<TenantMismatchRegistry>.value(value: mismatchRegistry),
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
