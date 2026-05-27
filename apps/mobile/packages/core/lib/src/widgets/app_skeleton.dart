import 'package:flutter/material.dart';
import 'package:skeletonizer/skeletonizer.dart';

import '../design/theme/app_theme_ext.dart';

/// Wraps [Skeletonizer] with brand-tuned effects. When [enabled] the child's
/// real layout is rendered as shimmering bones — so skeletons always match the
/// final UI exactly. Honors the platform "reduce motion" setting by dropping
/// the shimmer for a static fill.
class AppSkeletonizer extends StatelessWidget {
  const AppSkeletonizer({
    super.key,
    required this.enabled,
    required this.child,
  });

  final bool enabled;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final reduceMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    return Skeletonizer(
      enabled: enabled,
      effect: reduceMotion
          ? SolidColorEffect(color: colors.surfaceSoft)
          : ShimmerEffect(
              baseColor: colors.surfaceSoft,
              highlightColor: colors.hairline,
              duration: const Duration(milliseconds: 1400),
            ),
      child: child,
    );
  }
}
