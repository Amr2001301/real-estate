import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('Firebase push is not supported on this platform.');
    }
  }

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyB6eud6l_CHNk2HuyO-kLJBhBom-vLNoVM',
    appId: '1:263789595470:ios:5cf2db7615c8295397ac1f',
    messagingSenderId: '263789595470',
    projectId: 'real-estate-platform-238d6',
    storageBucket: 'real-estate-platform-238d6.firebasestorage.app',
    iosBundleId: 'com.realestate.staff.mobileStaff',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCePXKUedBLWujzogp2k7rrbWsye5BeOeA',
    appId: '1:263789595470:android:815d46e6c91e0a8f97ac1f',
    messagingSenderId: '263789595470',
    projectId: 'real-estate-platform-238d6',
    storageBucket: 'real-estate-platform-238d6.firebasestorage.app',
  );
}
