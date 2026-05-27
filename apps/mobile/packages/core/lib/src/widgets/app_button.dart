import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';

/// Visual variants mirrored from the web Button component.
enum AppButtonVariant { primary, gold, outline, ghost }

enum AppButtonSize { small, medium, large }

/// The primary action button for both apps. Pill-shaped, brand-colored, with a
/// built-in loading state and optional leading icon. RTL-safe by construction.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.size = AppButtonSize.large,
    this.icon,
    this.isLoading = false,
    this.expand = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final IconData? icon;
  final bool isLoading;

  /// When true, stretches to the available width.
  final bool expand;

  double get _height => switch (size) {
        AppButtonSize.small => 40,
        AppButtonSize.medium => 48,
        AppButtonSize.large => 52,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final textStyle = Theme.of(context).textTheme.labelLarge;
    final enabled = onPressed != null && !isLoading;

    final (Color bg, Color fg, BorderSide side) = switch (variant) {
      AppButtonVariant.primary => (colors.brandNavy, Colors.white, BorderSide.none),
      AppButtonVariant.gold => (colors.brandGold, colors.brandNavy, BorderSide.none),
      AppButtonVariant.outline => (
          Colors.transparent,
          colors.ink,
          BorderSide(color: colors.hairline),
        ),
      AppButtonVariant.ghost => (Colors.transparent, colors.ink, BorderSide.none),
    };

    final child = isLoading
        ? SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: fg),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: fg),
                const SizedBox(width: AppSpacing.xs),
              ],
              Flexible(
                child: Text(
                  label,
                  style: textStyle?.copyWith(color: fg),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          );

    final button = Opacity(
      opacity: enabled ? 1 : 0.55,
      child: Material(
        color: bg,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.pillAll,
          side: side,
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: enabled ? onPressed : null,
          child: SizedBox(
            height: _height,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
              child: Center(child: child),
            ),
          ),
        ),
      ),
    );

    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}
