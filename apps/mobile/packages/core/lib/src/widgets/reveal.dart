import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../design/tokens/app_spacing.dart';

/// A small entrance wrapper: fades [child] in with a subtle upward slide.
/// Mirrors the website's Reveal/Stagger motion. Honors the platform
/// "reduce motion" setting — when enabled it renders the child statically.
class Reveal extends StatelessWidget {
  const Reveal({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.dy = 0.08,
    this.duration = const Duration(milliseconds: 450),
  });

  final Widget child;
  final Duration delay;

  /// Vertical slide offset as a fraction of the child's height.
  final double dy;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduceMotion) return child;

    return child
        .animate(delay: delay)
        .fadeIn(duration: duration, curve: Curves.easeOutCubic)
        .slideY(begin: dy, end: 0, duration: duration, curve: Curves.easeOutCubic);
  }
}

/// Lays out [children] in a column, each revealed with an incrementing delay so
/// they cascade in (default 80ms step, matching the web Stagger). Respects
/// reduce-motion via [Reveal]. Optional [spacing] inserts gaps between items.
class StaggeredColumn extends StatelessWidget {
  const StaggeredColumn({
    super.key,
    required this.children,
    this.step = const Duration(milliseconds: 80),
    this.initialDelay = Duration.zero,
    this.crossAxisAlignment = CrossAxisAlignment.stretch,
    this.spacing = AppSpacing.sm,
  });

  final List<Widget> children;
  final Duration step;
  final Duration initialDelay;
  final CrossAxisAlignment crossAxisAlignment;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    final items = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0 && spacing > 0) items.add(SizedBox(height: spacing));
      items.add(
        Reveal(
          delay: initialDelay + step * i,
          child: children[i],
        ),
      );
    }
    return Column(crossAxisAlignment: crossAxisAlignment, children: items);
  }
}
