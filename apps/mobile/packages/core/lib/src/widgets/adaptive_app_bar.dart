import 'package:flutter/material.dart';

import '../design/platform/app_platform.dart';
import '../design/theme/app_theme_ext.dart';

/// A top app bar that adapts its layout per platform while keeping Devora
/// tokens: on iOS/macOS the title is centered and semibold with no scroll
/// elevation (Cupertino feel); on Android it stays start-aligned with the
/// Material tonal scroll-under elevation. Implements [PreferredSizeWidget] so
/// it drops straight into `Scaffold.appBar`.
class AdaptiveAppBar extends StatelessWidget implements PreferredSizeWidget {
  const AdaptiveAppBar({
    super.key,
    required this.title,
    this.actions,
    this.leading,
  });

  final Widget title;
  final List<Widget>? actions;
  final Widget? leading;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final apple = context.isApplePlatform;
    final theme = Theme.of(context);

    return AppBar(
      title: title,
      leading: leading,
      actions: actions,
      centerTitle: apple ? true : false,
      elevation: 0,
      scrolledUnderElevation: apple ? 0 : 0.5,
      titleTextStyle: apple
          ? theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: context.appColors.inkStrong,
            )
          : (theme.appBarTheme.titleTextStyle ?? theme.textTheme.titleLarge),
    );
  }
}
