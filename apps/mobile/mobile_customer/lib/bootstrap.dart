import 'dart:async';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_performance/firebase_performance.dart';
import 'package:flutter/foundation.dart'
    show TargetPlatform, ValueNotifier, defaultTargetPlatform;
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';


import 'app.dart';
import 'company_lock.dart';
import 'crashlytics_reporter.dart';
import 'feature_flags.dart';
import 'firebase_options.dart';
import 'features/notifications/presentation/fcm_route_resolver.dart';
import 'startup/customer_startup_service.dart';

/// Root navigator key — gives access to the root [Overlay] from contexts
/// that are ancestors of [MaterialApp] (e.g. FCM foreground listeners).
final GlobalKey<NavigatorState> customerNavigatorKey = GlobalKey<NavigatorState>();

/// Pending deep-link route from a push tap while the app was terminated.
/// Checked by [CustomerApp] after the router is created.
String? pendingPushRoute;

/// Shared plugin instance — initialised during bootstrap, used in [CustomerApp].
final FlutterLocalNotificationsPlugin flutterLocalNotifications =
    FlutterLocalNotificationsPlugin();

/// K2 startup tenant validation outcome. Initialised to [TenantStartupOutcome.noSlug]
/// (the safest default) and set during [bootstrap] BEFORE [buildAppRoot] and
/// [SessionCubit.restore] run. Updated by [StartupRetryScreen] on successful
/// retry so the router re-evaluates and unblocks navigation.
///
/// The [SessionCubit.restore] additionalCheck closure reads this value:
///   valid        → true  (restore session)
///   unavailable  → false (SessionCubit clears tokens)
///   networkError → null  (preserve tokens; retry can restore later)
///   noSlug       → false (SessionCubit clears any orphaned tokens)
final ValueNotifier<TenantStartupOutcome> customerStartupOutcome =
    ValueNotifier(TenantStartupOutcome.noSlug);

/// Background/terminated FCM message handler — must be a top-level function.
/// Runs in a separate isolate; no UI access available.
@pragma('vm:entry-point')
Future<void> _fcmBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM] Background message: ${message.messageId}');
}

/// Shared startup used by every flavor entrypoint (main_dev/staging/prod).
Future<void> bootstrap(EnvConfig env) async {
  WidgetsFlutterBinding.ensureInitialized();
  // Every customer app is one company's (there is no company picker): a
  // build without its company would have nothing to open.
  if (!kIsCompanyLocked) {
    throw StateError(
      'This build has no company. Build it with '
      '--dart-define-from-file=build/company/dart_defines.json (store builds, '
      'see tool/prepare_company_app.py) or --dart-define=COMPANY_SLUG=default '
      '(local dev against the seed).',
    );
  }
  final config = EnvConfig.initialize(env);

  debugPrint('[Startup] platform=${defaultTargetPlatform.name} apiBaseUrl=${config.apiBaseUrl}');

  // Initialize local notifications (Android channel + iOS foreground options).
  await _initLocalNotifications();

  // Initialize Firebase — gracefully degraded when credentials are missing or
  // when the SDK hangs on the iOS simulator (no GoogleService-Info.plist).
  await _initFirebase().timeout(
    const Duration(seconds: 5),
    onTimeout: () => debugPrint('[Firebase] init timed out — FCM disabled'),
  );

  // K2: Exact-resolve the persisted tenant BEFORE buildAppRoot so that
  // SessionCubit.restore() cannot emit authenticated for an ineligible tenant.
  // This is the authoritative security gate — no authenticated request may
  // reach an ineligible tenant's backend.
  if (kEnableCustomerTenantSelection) {
    // The app's company comes from its build.
    const slug = kLockedCompanySlug;
    customerStartupOutcome.value = await _bootstrapResolve(config, slug);
    debugPrint('[Startup] K2: slug=$slug outcome=${customerStartupOutcome.value}');
  }

  runApp(await buildAppRoot(
    env: config,
    child: const CustomerApp(),
    // K2: gate session restoration on pre-validated tenant eligibility.
    // The exact resolve already ran above; this closure reads the result.
    sessionRestoreCheck: kEnableCustomerTenantSelection
        ? (_) async {
            return switch (customerStartupOutcome.value) {
              TenantStartupOutcome.valid => true,       // restore session
              TenantStartupOutcome.unavailable => false, // clear tokens
              TenantStartupOutcome.networkError => null, // preserve tokens, block
              TenantStartupOutcome.noSlug => false,      // clear orphaned tokens
            };
          }
        : null,
    // K2: send X-Tenant-Slug on authenticated requests for mismatch defense.
    // Reads the live storage value at request time so the interceptor always
    // sees the current selection (not a stale value captured at startup).
    readTenantSlug: kEnableCustomerTenantSelection
        ? () async => kLockedCompanySlug
        : null,
  ));
}

/// Performs a single anonymous resolve call using a minimal Dio instance
/// (no interceptors needed — this endpoint is public and anonymous).
///
/// Returns the startup outcome for the given slug:
/// - [TenantStartupOutcome.valid]       → company found and eligible
/// - [TenantStartupOutcome.unavailable] → company 404 / inactive / disabled
/// - [TenantStartupOutcome.networkError] → connection/timeout failure
Future<TenantStartupOutcome> _bootstrapResolve(EnvConfig env, String slug) async {
  final dio = Dio(BaseOptions(
    baseUrl: env.apiBaseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));
  try {
    final res = await dio.get<Map<String, dynamic>>(
      '/public/companies/resolve',
      queryParameters: {'slug': slug},
    );
    return (res.statusCode == 200 && res.data != null)
        ? TenantStartupOutcome.valid
        : TenantStartupOutcome.unavailable;
  } on DioException catch (e) {
    if (e.response?.statusCode == 404) return TenantStartupOutcome.unavailable;
    return TenantStartupOutcome.networkError;
  } catch (_) {
    return TenantStartupOutcome.networkError;
  } finally {
    dio.close();
  }
}

Future<void> _initLocalNotifications() async {
  try {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    await flutterLocalNotifications.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
    );
    // Create the Android notification channel so FCM and local notifications
    // both use the same importance/sound configuration.
    final androidPlugin = flutterLocalNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    // High-importance channel for background/terminated FCM (shows heads-up).
    await androidPlugin?.createNotificationChannel(const AndroidNotificationChannel(
      'devora_push',
      'Push Notifications',
      importance: Importance.high,
    ));
    // Default-importance channel for foreground sound only (no heads-up popup).
    await androidPlugin?.createNotificationChannel(const AndroidNotificationChannel(
      'devora_sound',
      'Notification Sound',
      importance: Importance.defaultImportance,
      playSound: true,
      enableVibration: false,
    ));
    debugPrint('[LocalNotifications] initialized');
  } catch (e) {
    // Plugin native code not linked yet (first run after adding dependency).
    // Foreground notifications will be unavailable until a full rebuild.
    debugPrint('[LocalNotifications] init failed (rebuild required?): $e');
  }
}

Future<void> _initFirebase() async {
  try {
    // A company's own Android app is its own Firebase app: its options come
    // from the google-services.json it was built with (the Google Services
    // plugin picks the entry for its package). The shared app and iOS keep
    // the generated options.
    final ownAndroidApp =
        kIsCompanyLocked && defaultTargetPlatform == TargetPlatform.android;
    await Firebase.initializeApp(
      options: ownAndroidApp ? null : DefaultFirebaseOptions.currentPlatform,
    );

    // Crashlytics: route all uncaught Flutter errors + set the app error reporter.
    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
    AppLog.reporter = const CrashlyticsErrorReporter();

    FirebaseMessaging.onBackgroundMessage(_fcmBackgroundHandler);

    // Show alert/badge/sound on iOS even while the app is in the foreground.
    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    // Capture initial message (app opened from terminated state via push tap).
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      pendingPushRoute = resolveFcmRoute(initialMessage);
    }

    await FirebasePerformance.instance.setPerformanceCollectionEnabled(true);

    debugPrint('[Firebase] FCM + Crashlytics + Performance initialized');
  } catch (e) {
    // Firebase credentials not configured yet — push and crash reporting disabled.
    debugPrint('[Firebase] FCM disabled: $e');
  }
}
