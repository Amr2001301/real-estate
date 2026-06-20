import 'package:core/core.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/widgets.dart';

import 'app.dart';
import 'firebase_options.dart';
import 'features/notifications/presentation/fcm_route_resolver.dart';

/// Pending deep-link route from a push tap while the app was terminated.
/// Checked by [StaffApp] after the router is created.
String? pendingPushRoute;

/// Background/terminated FCM message handler — must be a top-level function.
@pragma('vm:entry-point')
Future<void> _fcmBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM] Staff background message: ${message.messageId}');
}

/// Shared startup for every Staff App flavor entrypoint.
Future<void> bootstrap(EnvConfig env) async {
  WidgetsFlutterBinding.ensureInitialized();
  EnvConfig.initialize(env);
  await _initFirebase();
  runApp(await buildAppRoot(env: EnvConfig.current, child: const StaffApp()));
}

Future<void> _initFirebase() async {
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    FirebaseMessaging.onBackgroundMessage(_fcmBackgroundHandler);

    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      pendingPushRoute = resolveStaffFcmRoute(initialMessage);
    }

    debugPrint('[Firebase] Staff FCM initialized');
  } catch (e) {
    debugPrint('[Firebase] Staff FCM disabled: $e');
  }
}
