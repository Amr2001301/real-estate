import 'package:core/core.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'app.dart';
import 'firebase_options.dart';
import 'features/notifications/presentation/fcm_route_resolver.dart';

/// Root navigator key — gives access to the root [Overlay] from contexts
/// that are ancestors of [MaterialApp] (e.g. FCM foreground listeners).
final GlobalKey<NavigatorState> customerNavigatorKey = GlobalKey<NavigatorState>();

/// Pending deep-link route from a push tap while the app was terminated.
/// Checked by [CustomerApp] after the router is created.
String? pendingPushRoute;

/// Shared plugin instance — initialised during bootstrap, used in [CustomerApp].
final FlutterLocalNotificationsPlugin flutterLocalNotifications =
    FlutterLocalNotificationsPlugin();

/// Background/terminated FCM message handler — must be a top-level function.
/// Runs in a separate isolate; no UI access available.
@pragma('vm:entry-point')
Future<void> _fcmBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM] Background message: ${message.messageId}');
}

/// Shared startup used by every flavor entrypoint (main_dev/staging/prod).
Future<void> bootstrap(EnvConfig env) async {
  WidgetsFlutterBinding.ensureInitialized();
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

  runApp(await buildAppRoot(env: EnvConfig.current, child: const CustomerApp()));
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
      'Devora Push',
      importance: Importance.high,
    ));
    // Default-importance channel for foreground sound only (no heads-up popup).
    await androidPlugin?.createNotificationChannel(const AndroidNotificationChannel(
      'devora_sound',
      'Devora Sound',
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
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
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

    debugPrint('[Firebase] FCM initialized');
  } catch (e) {
    // Firebase credentials not configured yet — push is disabled.
    // See docs/mobile-firebase-setup.md to enable.
    debugPrint('[Firebase] FCM disabled: $e');
  }
}
