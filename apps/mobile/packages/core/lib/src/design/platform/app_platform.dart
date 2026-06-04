import 'package:flutter/material.dart';

/// Platform-flavor detection for adaptive UI.
///
/// Reads `Theme.of(context).platform` (not `dart:io`) so it honors
/// `ThemeData.platform` overrides and is controllable in widget tests, while
/// still resolving to the real device platform in production.
extension AppPlatform on BuildContext {
  /// True on iOS/macOS — render Cupertino-flavored chrome and interactions.
  bool get isApplePlatform {
    final platform = Theme.of(this).platform;
    return platform == TargetPlatform.iOS || platform == TargetPlatform.macOS;
  }
}
