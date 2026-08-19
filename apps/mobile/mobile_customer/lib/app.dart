import 'dart:async';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'features/auth/data/datasources/auth_remote_data_source.dart';
import 'features/auth/data/repositories/auth_repository_impl.dart';
import 'features/auth/domain/repositories/auth_repository.dart';
import 'features/auth/domain/usecases/login_with_email.dart';
import 'features/auth/domain/usecases/logout_user.dart';
import 'features/auth/domain/usecases/register_customer.dart';
import 'features/auth/domain/usecases/request_otp.dart';
import 'features/auth/domain/usecases/verify_otp.dart';
import 'features/auth/presentation/auth_cubit.dart';
import 'features/catalog/data/datasources/catalog_remote_data_source.dart';
import 'features/catalog/data/repositories/catalog_repository_impl.dart';
import 'features/catalog/domain/repositories/catalog_repository.dart';
import 'features/catalog/presentation/compare/compare_cubit.dart';
import 'features/chat/data/datasources/chat_remote_data_source.dart';
import 'features/chat/data/repositories/chat_repository_impl.dart';
import 'features/chat/domain/repositories/chat_repository.dart';
import 'features/contracts/data/datasources/contracts_remote_data_source.dart';
import 'features/contracts/data/repositories/contracts_repository_impl.dart';
import 'features/contracts/domain/repositories/contracts_repository.dart';
import 'features/deposits/data/datasources/deposits_remote_data_source.dart';
import 'features/deposits/data/repositories/deposits_repository_impl.dart';
import 'features/deposits/domain/repositories/deposits_repository.dart';
import 'features/installments/data/datasources/installments_remote_data_source.dart';
import 'features/installments/data/repositories/installments_repository_impl.dart';
import 'features/installments/domain/repositories/installments_repository.dart';
import 'features/documents/data/datasources/documents_remote_data_source.dart';
import 'features/documents/data/repositories/documents_repository_impl.dart';
import 'features/documents/domain/repositories/documents_repository.dart';
import 'features/maintenance/data/datasources/maintenance_remote_data_source.dart';
import 'features/maintenance/data/repositories/maintenance_repository_impl.dart';
import 'features/maintenance/domain/repositories/maintenance_repository.dart';
import 'features/my_property/data/datasources/my_property_remote_data_source.dart';
import 'features/my_property/data/repositories/my_property_repository_impl.dart';
import 'features/my_property/domain/repositories/my_property_repository.dart';
import 'features/favorites/data/datasources/favorites_remote_data_source.dart';
import 'features/favorites/data/repositories/favorites_repository_impl.dart';
import 'features/favorites/domain/repositories/favorites_repository.dart';
import 'features/favorites/domain/usecases/add_favorite.dart';
import 'features/favorites/domain/usecases/get_favorites.dart';
import 'features/favorites/domain/usecases/remove_favorite.dart';
import 'features/favorites/presentation/favorites_cubit.dart';
import 'features/home_summary/data/datasources/home_summary_remote_data_source.dart';
import 'features/home_summary/data/repositories/home_summary_repository_impl.dart';
import 'features/home_summary/domain/repositories/home_summary_repository.dart';
import 'features/notifications/data/datasources/notifications_remote_data_source.dart';
import 'features/notifications/data/firebase_push_token_provider.dart';
import 'features/notifications/data/repositories/notifications_repository_impl.dart';
import 'features/notifications/domain/repositories/notifications_repository.dart';
import 'features/notifications/domain/usecases/notification_use_cases.dart';
import 'features/notifications/presentation/push_registration_service.dart';
import 'features/notifications/presentation/unread_count_cubit.dart';
import 'features/profile/data/datasources/profile_remote_data_source.dart';
import 'features/profile/data/repositories/profile_repository_impl.dart';
import 'features/profile/domain/repositories/profile_repository.dart';
import 'features/visits/data/datasources/visits_remote_data_source.dart';
import 'features/visits/data/repositories/visits_repository_impl.dart';
import 'features/visits/domain/repositories/visits_repository.dart';
import 'features/info_request/data/datasources/info_request_remote_data_source.dart';
import 'features/info_request/data/repositories/info_request_repository_impl.dart';
import 'features/info_request/domain/repositories/info_request_repository.dart';
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'bootstrap.dart' show customerNavigatorKey, flutterLocalNotifications, pendingPushRoute;
import 'features/notifications/presentation/fcm_route_resolver.dart';
import 'router/app_router.dart';

/// Root of the Customer App. Provides feature repositories (data→domain
/// contracts) + app-wide cubits, then wires the 401→refresh handler and
/// favorites-load-on-auth before building the router.
class CustomerApp extends StatelessWidget {
  const CustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<AuthRepository>(
          create: (ctx) => AuthRepositoryImpl(
            AuthRemoteDataSourceImpl(ctx.read<Dio>()),
            ctx.read<TokenStorage>(),
          ),
        ),
        RepositoryProvider<CatalogRepository>(
          create: (ctx) =>
              CatalogRepositoryImpl(CatalogRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<ChatRepository>(
          create: (ctx) => ChatRepositoryImpl(
            ChatRemoteDataSourceImpl(ctx.read<Dio>(), ctx.read<TokenStorage>()),
          ),
        ),
        RepositoryProvider<ProfileRepository>(
          create: (ctx) =>
              ProfileRepositoryImpl(ProfileRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<FavoritesRepository>(
          create: (ctx) => FavoritesRepositoryImpl(
            FavoritesRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<VisitsRepository>(
          create: (ctx) =>
              VisitsRepositoryImpl(VisitsRemoteDataSourceImpl(ctx.read<Dio>())),
        ),
        RepositoryProvider<NotificationsRepository>(
          create: (ctx) => NotificationsRepositoryImpl(
            NotificationsRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<MyPropertyRepository>(
          create: (ctx) => MyPropertyRepositoryImpl(
            MyPropertyRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<ContractsRepository>(
          create: (ctx) => ContractsRepositoryImpl(
            ContractsRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<DepositsRepository>(
          create: (ctx) => DepositsRepositoryImpl(
            DepositsRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<InstallmentsRepository>(
          create: (ctx) => InstallmentsRepositoryImpl(
            InstallmentsRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<MaintenanceRepository>(
          create: (ctx) => MaintenanceRepositoryImpl(
            MaintenanceRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<DocumentsRepository>(
          create: (ctx) => DocumentsRepositoryImpl(
            DocumentsRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<HomeSummaryRepository>(
          create: (ctx) => HomeSummaryRepositoryImpl(
            HomeSummaryRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<InfoRequestRepository>(
          create: (ctx) => InfoRequestRepositoryImpl(
            InfoRequestRemoteDataSourceImpl(ctx.read<Dio>()),
          ),
        ),
        RepositoryProvider<PushRegistrationService>(
          create: (ctx) => PushRegistrationService(
            const FirebasePushTokenProvider(),
            RegisterDevice(ctx.read<NotificationsRepository>()),
          ),
        ),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider(create: (_) => CompareCubit()),
          BlocProvider<FavoritesCubit>(
            create: (ctx) {
              final repo = ctx.read<FavoritesRepository>();
              return FavoritesCubit(
                GetFavorites(repo),
                AddFavorite(repo),
                RemoveFavorite(repo),
              );
            },
          ),
          BlocProvider<UnreadCountCubit>(
            create: (ctx) => UnreadCountCubit(
              GetUnreadCount(ctx.read<NotificationsRepository>()),
            ),
          ),
          BlocProvider<AuthCubit>(
            create: (ctx) {
              final repo = ctx.read<AuthRepository>();
              return AuthCubit(
                sessionCubit: ctx.read<SessionCubit>(),
                loginWithEmail: LoginWithEmail(repo),
                registerCustomer: RegisterCustomer(repo),
                requestOtp: RequestOtp(repo),
                verifyOtp: VerifyOtp(repo),
                logoutUser: LogoutUser(repo),
              );
            },
          ),
          BlocProvider(create: (_) => ConnectivityCubit()),
        ],
        child: const _CustomerRoot(),
      ),
    );
  }
}

class _CustomerRoot extends StatefulWidget {
  const _CustomerRoot();

  @override
  State<_CustomerRoot> createState() => _CustomerRootState();
}

class _CustomerRootState extends State<_CustomerRoot> {
  late final router = createCustomerRouter(
    context.read<SessionCubit>(),
    navigatorKey: customerNavigatorKey,
  );

  // FCM stream subscriptions. Null when Firebase is not configured.
  StreamSubscription<RemoteMessage>? _fcmOpenSub;
  StreamSubscription<RemoteMessage>? _fcmFgSub;
  StreamSubscription<String>? _tokenSub;

  // Last notificationId shown as a banner — prevents duplicate overlays when
  // the same FCM message is delivered more than once.
  String? _lastBannerId;

  @override
  void initState() {
    super.initState();
    _wireRefresher();
    _wireFcm();
    // BlocListener only fires on *transitions*. If the app relaunches with a
    // persisted session the state is already authenticated — no transition fires
    // and registration would be skipped. Run best-effort after the first frame.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (context.read<SessionCubit>().state.isAuthenticated) {
        context.read<PushRegistrationService>().registerIfPossible();
      }
    });
  }

  @override
  void dispose() {
    _fcmOpenSub?.cancel();
    _fcmFgSub?.cancel();
    _tokenSub?.cancel();
    super.dispose();
  }

  /// Wires FCM message streams. Guarded: if Firebase was not initialised (no
  /// credentials) these streams are not available and the app continues normally.
  void _wireFcm() {
    try {
      // App in background → user taps push notification.
      _fcmOpenSub = FirebaseMessaging.onMessageOpenedApp.listen((msg) {
        final route = resolveFcmRoute(msg);
        if (route != null) router.push(route);
      });

      // App in foreground → branded in-app banner + refresh unread badge.
      _fcmFgSub = FirebaseMessaging.onMessage.listen((msg) {
        debugPrint('[FCM] foreground message received');
        if (!mounted) return;
        context.read<UnreadCountCubit>().load();

        final n    = msg.notification;
        final title = n?.title  ?? msg.data['title']  as String? ?? '';
        final body  = n?.body   ?? msg.data['body']   as String? ?? '';
        if (title.isEmpty && body.isEmpty) return;

        // Guard duplicate banners for the same DB notification row.
        final notifId = msg.data['notificationId'] as String?;
        if (notifId != null && notifId == _lastBannerId) return;
        _lastBannerId = notifId;

        final route = resolveFcmRoute(msg);
        HapticFeedback.lightImpact();
        _playForegroundSound();
        showAppNotificationBanner(
          context,
          overlay: customerNavigatorKey.currentState?.overlay,
          title: title,
          body: body,
          onTap: route != null ? () { if (mounted) router.push(route); } : null,
        );
      });

      // FCM token refreshed by platform → re-register with the backend.
      _tokenSub = FirebaseMessaging.instance.onTokenRefresh.listen((_) {
        if (mounted) context.read<PushRegistrationService>().registerIfPossible();
      });

      // App opened from terminated state via push tap.
      if (pendingPushRoute != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          router.push(pendingPushRoute!);
          pendingPushRoute = null;
        });
      }
    } catch (_) {
      // Firebase not initialised — push is disabled; IN_APP continues normally.
    }
  }

  /// Wires the 401→refresh handler now that the auth repository exists. On
  /// refresh failure: clear storage + sign out (router redirects to login).
  void _wireRefresher() {
    final authRepo = context.read<AuthRepository>();
    final tokenStorage = context.read<TokenStorage>();
    final sessionCubit = context.read<SessionCubit>();
    context.read<SessionRefresherRegistry>().handler = () async {
      final result = await authRepo.refreshSession();
      if (result.isOk) return tokenStorage.readAccessToken();
      await tokenStorage.clear();
      sessionCubit.adoptSignedOut();
      return null;
    };
  }

  /// Plays the default notification sound on Android without showing a heads-up
  /// popup. Uses the low-importance `devora_sound` channel (no visual popup) and
  /// cancels the notification immediately so the drawer stays clean.
  /// iOS sound is handled by [setForegroundNotificationPresentationOptions].
  Future<void> _playForegroundSound() async {
    try {
      const details = NotificationDetails(
        android: AndroidNotificationDetails(
          'devora_sound',
          'Devora Sound',
          importance: Importance.defaultImportance,
          priority: Priority.defaultPriority,
          playSound: true,
          enableVibration: false,
          autoCancel: true,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: false,
          presentBadge: false,
          presentSound: false,
        ),
      );
      await flutterLocalNotifications.show(98765, null, null, details);
      Future.delayed(const Duration(milliseconds: 300), () {
        flutterLocalNotifications.cancel(98765);
      });
      debugPrint('[Banner] sound played true');
    } catch (e) {
      debugPrint('[Banner] sound played false: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeMode = context.watch<ThemeCubit>().state;
    final locale = context.watch<LocaleCubit>().state;
    final isArabic = locale.languageCode == 'ar';

    return BlocListener<SessionCubit, SessionState>(
      listenWhen: (a, b) => a.isAuthenticated != b.isAuthenticated,
      listener: (context, state) {
        if (state.isAuthenticated) {
          context.read<FavoritesCubit>().load();
          context.read<UnreadCountCubit>().load();
          // Best-effort device registration (no-op until a real push provider).
          context.read<PushRegistrationService>().registerIfPossible();
        } else {
          context.read<FavoritesCubit>().clear();
          context.read<UnreadCountCubit>().clear();
        }
      },
      child: MaterialApp.router(
        onGenerateTitle: (ctx) => ctx.l10n.customerAppTitle,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(isArabic: isArabic),
        darkTheme: AppTheme.dark(isArabic: isArabic),
        themeMode: themeMode,
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        routerConfig: router,
        builder: (context, child) => Column(
          children: [
            const OfflineBanner(),
            Expanded(child: child ?? const SizedBox.shrink()),
          ],
        ),
      ),
    );
  }
}
