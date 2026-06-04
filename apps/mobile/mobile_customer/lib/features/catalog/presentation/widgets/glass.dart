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

/// A single frosted circular button backdrop for on-image card actions
/// (favorite/compare) — keeps dark glyphs legible and reads as an elegant,
/// separate control rather than a bulky capsule. Sizes to its [child] (≈38px).
class GlassCircle extends StatelessWidget {
  const GlassCircle({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipOval(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: colors.surface.withValues(alpha: 0.74),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Premium card surface: a 22px rounded, shadow-only (no border) tappable
/// container. Distinct from the bordered [AppCard] — floats more, reads more
/// luxe. Clips its child so image corners round with the card.
class LuxeCard extends StatelessWidget {
  const LuxeCard({super.key, required this.child, this.onTap, this.radius = 22});

  final Widget child;
  final VoidCallback? onTap;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final r = BorderRadius.circular(radius);
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: r, boxShadow: colors.shadowCard),
      child: Material(
        color: colors.surface,
        borderRadius: r,
        clipBehavior: Clip.antiAlias,
        child: InkWell(onTap: onTap, child: child),
      ),
    );
  }
}

/// A bottom-weighted vignette for image-overlaid text (city/title/project).
/// Strong enough at the very bottom to keep text elegant, while the upper ~45%
/// stays clear so the photo isn't darkened.
class ImageScrim extends StatelessWidget {
  const ImageScrim({super.key});
  @override
  Widget build(BuildContext context) => const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0x1F000000),
              Color(0x00000000),
              Color(0x59000000),
              Color(0xCC000000),
            ],
            stops: [0.0, 0.45, 0.78, 1.0],
          ),
        ),
      );
}

/// A very subtle, edge-fading gold hairline — a restrained premium accent
/// placed between the image and the content.
class GoldHairline extends StatelessWidget {
  const GoldHairline({super.key});
  @override
  Widget build(BuildContext context) => const SizedBox(
        height: 2,
        width: double.infinity,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0x00C8A24B), Color(0x5CC8A24B), Color(0x00C8A24B)],
            ),
          ),
        ),
      );
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
