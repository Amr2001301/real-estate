import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';
import 'status_badge.dart';

/// Describes one selectable option in an [AppFilterPills] bar.
class FilterPillOption<T> {
  const FilterPillOption({
    required this.value,
    required this.label,
    this.tone,
  });

  final T value;
  final String label;

  /// Optional accent applied to the selected state.
  /// Defaults to gold when null.
  final BadgeTone? tone;
}

/// A horizontal-scrolling row of animated pill filters.
///
/// Renders an optional "all" pill (when [allLabel] is set) followed by one
/// pill per [options] entry. Selection is driven by [selected]: `null` means
/// no filter (show all), any other value activates the matching pill.
///
/// RTL note — the inner [Row] renders children right-to-left in RTL locales,
/// so the first option sits at the leading (right) edge of the screen. An
/// explicit trailing [SizedBox] guards the last pill from viewport clipping
/// (relying solely on [ScrollView] end-padding is unreliable in RTL).
class AppFilterPills<T> extends StatelessWidget {
  const AppFilterPills({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
    this.allLabel,
  });

  /// Ordered list of selectable filter options.
  final List<FilterPillOption<T>> options;

  /// Currently active filter. `null` means "show all" (no filter applied).
  final T? selected;

  /// Called when the user taps a pill. Receives `null` when the "all" pill
  /// is tapped.
  final ValueChanged<T?> onSelected;

  /// Label for the "show all" pill. Omit to hide the all-pill.
  final String? allLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return SizedBox(
      height: 46,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        // Leading padding via EdgeInsetsDirectional so it respects RTL.
        // Trailing gap is provided by the explicit SizedBox at end of Row.
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          4,
          0,
          4,
        ),
        child: Row(
          children: [
            if (allLabel != null) ...[
              _Pill(
                label: allLabel!,
                selected: selected == null,
                tone: null,
                colors: colors,
                onTap: () => onSelected(null),
              ),
              const SizedBox(width: AppSpacing.xs),
            ],
            for (final opt in options) ...[
              _Pill(
                label: opt.label,
                selected: selected == opt.value,
                tone: opt.tone,
                colors: colors,
                onTap: () => onSelected(opt.value),
              ),
              const SizedBox(width: AppSpacing.xs),
            ],
            // Explicit trailing gap — more reliable than relying on
            // SingleChildScrollView end-padding in RTL.
            const SizedBox(width: AppSpacing.sm),
          ],
        ),
      ),
    );
  }
}

// ── Internal animated pill ────────────────────────────────────────────────────
class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.selected,
    required this.tone,
    required this.colors,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final BadgeTone? tone;
  final AppColorsExt colors;
  final VoidCallback onTap;

  Color get _accent => switch (tone) {
    BadgeTone.gold => colors.brandGold,
    BadgeTone.success => colors.success,
    BadgeTone.warning => colors.warning,
    BadgeTone.error => colors.error,
    BadgeTone.info => colors.info,
    BadgeTone.navy => const Color(0xFF14273F),
    _ => colors.brandGold,
  };

  @override
  Widget build(BuildContext context) {
    final accent = _accent;
    final bg = selected ? accent : colors.surface;
    final fg = selected ? Colors.white : colors.inkStrong;
    final borderColor = selected ? accent : colors.hairline;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(color: borderColor),
          borderRadius: BorderRadius.circular(AppRadii.pill),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: accent.withValues(alpha: 0.28),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
            color: fg,
            height: 1.2,
          ),
        ),
      ),
    );
  }
}
