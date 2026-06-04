import 'dart:ui';

import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Frosted navy pill for on-image labels (status, project, featured, city) —
/// the website's `bg-navy/55 ring-white/15 backdrop-blur` treatment. Content
/// (text/icons) defaults to white.
class GlassPill extends StatelessWidget {
  const GlassPill({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: 5,
          ),
          decoration: BoxDecoration(
            color: AppPalette.navy.withValues(alpha: 0.50),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
          ),
          child: DefaultTextStyle.merge(
            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
            child: IconTheme.merge(
              data: const IconThemeData(color: Colors.white, size: 14),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

/// Frosted light capsule hosting on-image action buttons (favorite/compare),
/// keeping their dark glyphs legible over any photo.
class GlassActionBar extends StatelessWidget {
  const GlassActionBar({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface.withValues(alpha: 0.72),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: children),
        ),
      ),
    );
  }
}

/// The small round "open" affordance used as the card's CTA anchor — a
/// surface-soft circle with a direction-aware arrow (points toward content flow
/// in both RTL and LTR).
class CardOpenArrow extends StatelessWidget {
  const CardOpenArrow({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: colors.surfaceSoft, shape: BoxShape.circle),
      child: Icon(
        rtl ? Icons.arrow_back_rounded : Icons.arrow_forward_rounded,
        size: 16,
        color: colors.inkStrong,
      ),
    );
  }
}
