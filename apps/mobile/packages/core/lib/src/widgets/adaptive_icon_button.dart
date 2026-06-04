import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../design/platform/app_platform.dart';

/// An icon button that feels native on each platform: a fade-on-press
/// [CupertinoButton] on iOS/macOS (no Material ripple) and a rippled
/// [IconButton] on Android. Color is inherited from the ambient [IconTheme]
/// (e.g. the app bar foreground), so it stays on-brand on both.
class AdaptiveIconButton extends StatelessWidget {
  const AdaptiveIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.tooltip,
  });

  final Widget icon;
  final VoidCallback? onPressed;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    if (context.isApplePlatform) {
      final button = CupertinoButton(
        padding: EdgeInsets.zero,
        minimumSize: const Size.square(44), // iOS minimum tap target
        onPressed: onPressed,
        child: icon,
      );
      return tooltip != null ? Tooltip(message: tooltip!, child: button) : button;
    }
    return IconButton(icon: icon, tooltip: tooltip, onPressed: onPressed);
  }
}
