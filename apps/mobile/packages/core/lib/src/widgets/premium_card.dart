import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';
import 'app_card.dart' show AppCardElevation;
import 'app_tone.dart';

/// A richer surface than [AppCard], matching the website's account cards:
/// surface fill + hairline border + soft shadow, with an OPTIONAL status
/// accent rail on the start edge and an OPTIONAL gold corner glow. When [onTap]
/// is set it adds the same subtle press scale-down used by [AppCard].
///
/// [AppCard] is deliberately left untouched (lowest-risk); reach for
/// [PremiumCard] when you want the rail/glow treatment.
class PremiumCard extends StatefulWidget {
  const PremiumCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.elevation = AppCardElevation.card,
    this.accentRail,
    this.glow = false,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final AppCardElevation elevation;

  /// When set, paints a vertical gradient rail on the start (RTL-aware) edge.
  final AppTone? accentRail;

  /// When true, paints a soft radial gold glow in the top-end corner.
  final bool glow;

  @override
  State<PremiumCard> createState() => _PremiumCardState();
}

class _PremiumCardState extends State<PremiumCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    final shadows = switch (widget.elevation) {
      AppCardElevation.none => const <BoxShadow>[],
      AppCardElevation.soft => colors.shadowSoft,
      AppCardElevation.card => colors.shadowCard,
      AppCardElevation.lift => colors.shadowLift,
    };

    final railColor = widget.accentRail?.baseColor(colors);

    final inner = DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.card,
        border: Border.all(color: colors.hairline),
      ),
      child: Stack(
        children: [
          if (widget.glow)
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: AlignmentDirectional.topEnd.resolve(
                        Directionality.of(context),
                      ),
                      radius: 0.85,
                      colors: [
                        colors.brandGold.withValues(alpha: 0.12),
                        colors.brandGold.withValues(alpha: 0.0),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          Padding(padding: widget.padding, child: widget.child),
          if (railColor != null)
            PositionedDirectional(
              top: 0,
              bottom: 0,
              start: 0,
              child: Container(
                width: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      railColor.withValues(alpha: 0.35),
                      railColor.withValues(alpha: 0.75),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );

    // Shadow on the outer (unclipped) box; ClipRRect keeps rail/glow inside the
    // rounded corners.
    final card = AnimatedScale(
      scale: _pressed ? 0.985 : 1.0,
      duration: const Duration(milliseconds: 140),
      curve: const Cubic(0.32, 0.72, 0, 1),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: AppRadii.card,
          boxShadow: shadows,
        ),
        child: ClipRRect(borderRadius: AppRadii.card, child: inner),
      ),
    );

    if (widget.onTap == null) return card;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: card,
    );
  }
}
