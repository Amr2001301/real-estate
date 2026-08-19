import 'package:core/core.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_performance/firebase_performance.dart';
import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'app.dart';
import 'crashlytics_reporter.dart';
import 'firebase_options.dart';
import 'features/notifications/presentation/fcm_route_resolver.dart';

/// Root navigator key — gives access to the root [Overlay] from contexts
/// that are ancestors of [MaterialApp].
final GlobalKey<NavigatorState> staffNavigatorKey = GlobalKey<NavigatorState>();

/// Pending deep-link route from a push tap while the app was terminated.
/// Checked by [StaffApp] after the router is created.
String? pendingPushRoute;

/// Shared plugin instance — initialised during bootstrap, used in [StaffApp].
final FlutterLocalNotificationsPlugin flutterLocalNotifications =
    FlutterLocalNotificationsPlugin();

/// Background/terminated FCM message handler — must be a top-level function.
@pragma('vm:entry-point')
Future<void> _fcmBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM] Staff background message: ${message.messageId}');
}

/// Shared startup for every Staff App flavor entrypoint.
Future<void> bootstrap(EnvConfig env) async {
  WidgetsFlutterBinding.ensureInitialized();
  final config = EnvConfig.initialize(env);

  debugPrint('[Startup] platform=${defaultTargetPlatform.name} apiBaseUrl=${config.apiBaseUrl}');

  await _initLocalNotifications();
  await _initFirebase().timeout(
    const Duration(seconds: 5),
    onTimeout: () => debugPrint('[Firebase] init timed out — FCM disabled'),
  );
  runApp(await buildAppRoot(env: EnvConfig.current, child: const StaffApp()));
}

Future<void> _initLocalNotifications() async {
  try {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    await flutterLocalNotifications.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
    );
    final androidPlugin = flutterLocalNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(const AndroidNotificationChannel(
      'devora_push',
      'Devora Push',
      importance: Importance.high,
    ));
    await androidPlugin?.createNotificationChannel(const AndroidNotificationChannel(
      'devora_sound',
      'Devora Sound',
      importance: Importance.defaultImportance,
      playSound: true,
      enableVibration: false,
    ));
    debugPrint('[LocalNotifications] initialized');
  } catch (e) {
    debugPrint('[LocalNotifications] init failed (rebuild required?): $e');
  }
}

Future<void> _initFirebase() async {
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    // Crashlytics: route all uncaught Flutter errors + set the app error reporter.
    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
    AppLog.reporter = const CrashlyticsErrorReporter();

    FirebaseMessaging.onBackgroundMessage(_fcmBackgroundHandler);

    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      pendingPushRoute = resolveStaffFcmRoute(initialMessage);
    }

    await FirebasePerformance.instance.setPerformanceCollectionEnabled(true);

    debugPrint('[Firebase] Staff FCM + Crashlytics + Performance initialized');
  } catch (e) {
    debugPrint('[Firebase] Staff FCM disabled: $e');
  }
}
