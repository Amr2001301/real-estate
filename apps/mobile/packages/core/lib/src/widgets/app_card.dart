import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';

/// Elevation presets mapped to the shared shadow sets.
enum AppCardElevation { none, soft, card, lift }

/// The base surface container: surface fill, hairline border, optional shadow,
/// rounded to the card radius. When [onTap] is set it adds a subtle press
/// scale-down micro-interaction.
class AppCard extends StatefulWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.elevation = AppCardElevation.soft,
    this.clip = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final AppCardElevation elevation;
  final bool clip;

  @override
  State<AppCard> createState() => _AppCardState();
}

class _AppCardState extends State<AppCard> {
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

    final content = AnimatedContainer(
      duration: const Duration(milliseconds: 140),
      curve: const Cubic(0.32, 0.72, 0, 1),
      transform: Matrix4.identity()
        ..scaleByDouble(
          _pressed ? 0.985 : 1.0,
          _pressed ? 0.985 : 1.0,
          1,
          1,
        ),
      transformAlignment: Alignment.center,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.card,
        border: Border.all(color: colors.hairline),
        boxShadow: shadows,
      ),
      clipBehavior: widget.clip ? Clip.antiAlias : Clip.none,
      child: Padding(padding: widget.padding, child: widget.child),
    );

    if (widget.onTap == null) return content;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: content,
    );
  }
}
