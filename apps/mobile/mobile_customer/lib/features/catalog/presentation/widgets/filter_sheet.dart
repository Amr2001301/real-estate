import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Shared premium building blocks for the catalog filter bottom sheets
/// (projects + units) so both speak the same warm-luxe language: a rounded
/// cream/surface sheet, a header with a live active-count pill, gold-accented
/// section chips, and a pinned Reset / Apply footer. RTL-safe + dark-mode safe.

/// Presents [builder] as a premium catalog filter sheet: a warm-cream,
/// large-radius, scroll-controlled modal.
///
/// Presented on the **root navigator** (`useRootNavigator: true`) so the modal
/// route + barrier sit above the customer shell — the floating bottom dock and
/// the AI FAB are fully covered by the sheet/scrim while it's open, and return
/// untouched on close. Works the same on Android (covers the in-slot bar).
Future<T?> showAppFilterSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
}) {
  return showModalBottomSheet<T>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: false,
    backgroundColor: context.appColors.canvas,
    barrierColor: Colors.black.withValues(alpha: 0.5),
    clipBehavior: Clip.antiAlias,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.xxl)),
    ),
    builder: builder,
  );
}

/// The premium scaffold for a filter sheet: grabber → header (title + active
/// count + close) → gold hairline → scrollable [sections] → pinned footer with
/// Reset + Apply. Sections are spaced evenly; the footer lifts above the
/// keyboard.
class FilterSheetShell extends StatelessWidget {
  const FilterSheetShell({
    super.key,
    required this.title,
    required this.activeCount,
    required this.sections,
    required this.onReset,
    required this.onApply,
    required this.applyLabel,
    required this.resetLabel,
  });

  final String title;
  final int activeCount;
  final List<Widget> sections;
  final VoidCallback onReset;
  final VoidCallback onApply;
  final String applyLabel;
  final String resetLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    // Interleave sections with a compact, consistent vertical rhythm.
    final body = <Widget>[];
    for (var i = 0; i < sections.length; i++) {
      if (i > 0) body.add(const SizedBox(height: AppSpacing.md));
      body.add(sections[i]);
    }

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.88,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Gold-tinted grabber capsule.
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: colors.brandGold.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            // Header.
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.md,
              ),
              child: Row(
                children: [
                  Text(
                    title,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: colors.inkStrong,
                    ),
                  ),
                  if (activeCount > 0) ...[
                    const SizedBox(width: AppSpacing.sm),
                    _CountPill(activeCount),
                  ],
                  const Spacer(),
                  _SoftCloseButton(
                    onTap: () => Navigator.of(context).maybePop(),
                  ),
                ],
              ),
            ),
            // Gold hairline tying the header to the body.
            Container(
              height: 1,
              margin: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    colors.brandGold.withValues(alpha: 0.0),
                    colors.brandGold.withValues(alpha: 0.45),
                    colors.brandGold.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
            // Scrollable sections.
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.lg,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: body,
                ),
              ),
            ),
            // Pinned footer (lifts above the keyboard); a soft upward shadow
            // lifts it off the scrolling content.
            Container(
              decoration: BoxDecoration(
                color: colors.surface,
                border: Border(top: BorderSide(color: colors.hairline)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 16,
                    offset: const Offset(0, -3),
                  ),
                ],
              ),
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.md + MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: AppButton(
                      label: resetLabel,
                      variant: AppButtonVariant.outline,
                      onPressed: onReset,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: AppButton(
                      label: applyLabel,
                      variant: AppButtonVariant.gold,
                      onPressed: onApply,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A small gold-tinted pill showing the active-filter count in the header.
class _CountPill extends StatelessWidget {
  const _CountPill(this.count);
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: colors.brandGold.withValues(alpha: 0.16),
        borderRadius: AppRadii.pillAll,
        border: Border.all(color: colors.brandGold.withValues(alpha: 0.30)),
      ),
      child: Text(
        '$count',
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: colors.brandGold,
              fontWeight: FontWeight.w800,
            ),
      ),
    );
  }
}

/// A soft circular close button for the sheet header — a surface circle with a
/// hairline rim, matching the app's premium chrome controls.
class _SoftCloseButton extends StatelessWidget {
  const _SoftCloseButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: colors.surfaceSoft,
      shape: CircleBorder(side: BorderSide(color: colors.hairline)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Tooltip(
          message: MaterialLocalizations.of(context).closeButtonLabel,
          child: SizedBox(
            width: 36,
            height: 36,
            child: Icon(Icons.close_rounded, size: 18, color: colors.inkMuted),
          ),
        ),
      ),
    );
  }
}

/// A labelled filter section rendered as a compact premium card: a surface card
/// on the cream sheet with a gold accent before a bold title (or an [icon]),
/// then the section content (chips / range row). When [trailing] is set it sits
/// inline with the title (great for a one-line toggle row); when [child] is null
/// no content area is rendered. Optional [onTap] makes the whole card tappable
/// (used by the compact featured toggle). RTL-safe + dark-mode safe.
class FilterSection extends StatelessWidget {
  const FilterSection({
    super.key,
    required this.label,
    this.child,
    this.icon,
    this.trailing,
    this.onTap,
  });

  final String label;
  final Widget? child;

  /// Optional gold leading glyph; when null a slim gold accent bar is shown.
  final IconData? icon;

  /// Optional widget pinned to the end of the title row (e.g. a compact toggle).
  final Widget? trailing;

  /// When set, the whole card is tappable (e.g. a single-row boolean toggle).
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (icon != null)
              Icon(icon, size: 18, color: colors.brandGold)
            else
              Container(
                width: 4,
                height: 16,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [AppPalette.gold300, AppPalette.gold500],
                  ),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                label,
                style: theme.textTheme.titleSmall?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            ?trailing,
          ],
        ),
        if (child != null) ...[
          const SizedBox(height: AppSpacing.sm),
          child!,
        ],
      ],
    );

    final card = Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm + 2,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.8)),
        boxShadow: colors.shadowSoft,
      ),
      child: content,
    );

    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadii.lg),
      clipBehavior: Clip.antiAlias,
      child: InkWell(onTap: onTap, child: card),
    );
  }
}

/// A premium choice/toggle chip used inside filter sections. Selected = gold
/// fill + navy ink (pops in both light + dark); unselected = soft surface +
/// hairline. Optional leading [icon] (e.g. the featured star).
class FilterChoiceChip extends StatelessWidget {
  const FilterChoiceChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
    this.expand = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

  /// When true the chip fills its parent's width and centers its content
  /// (used inside [FilterChipGrid] for tidy equal-width pills).
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final fg = selected ? colors.brandNavy : colors.inkStrong;
    return Material(
      color: selected ? colors.brandGold : colors.surfaceSoft,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadii.pillAll,
        side: BorderSide(
          color: selected
              ? colors.brandGold
              : colors.hairline.withValues(alpha: 0.8),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs + 1,
          ),
          child: Row(
            mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment:
                expand ? MainAxisAlignment.center : MainAxisAlignment.start,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 16, color: fg),
                const SizedBox(width: AppSpacing.xs),
              ],
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: expand ? TextAlign.center : TextAlign.start,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: fg,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One choice in a [FilterChipGrid].
class FilterChipItem {
  const FilterChipItem({
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;
}

/// Lays out choice chips in a tidy fixed-column grid of equal-width pills —
/// keeps long-labelled groups (e.g. unit sort options) from wrapping into a
/// ragged, crowded cluster. Defaults to two columns.
class FilterChipGrid extends StatelessWidget {
  const FilterChipGrid({super.key, required this.items, this.columns = 2});

  final List<FilterChipItem> items;
  final int columns;

  @override
  Widget build(BuildContext context) {
    const gap = AppSpacing.xs;
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - gap * (columns - 1)) / columns;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final item in items)
              SizedBox(
                width: width,
                child: FilterChoiceChip(
                  label: item.label,
                  selected: item.selected,
                  onTap: item.onTap,
                  icon: item.icon,
                  expand: true,
                ),
              ),
          ],
        );
      },
    );
  }
}

/// A min/max range row built from two premium [AppTextField]s with a separator
/// and an optional trailing [unit] shown inside each field (e.g. ج.م / م²).
class FilterRangeRow extends StatelessWidget {
  const FilterRangeRow({
    super.key,
    required this.min,
    required this.max,
    required this.minHint,
    required this.maxHint,
    this.unit,
    this.onChanged,
  });

  final TextEditingController min;
  final TextEditingController max;
  final String minHint;
  final String maxHint;

  /// Optional unit token rendered inside each field (currency / area).
  final String? unit;

  /// Called whenever either field changes (so a paired slider can stay in sync).
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Expanded(
          child: AppTextField(
            controller: min,
            hint: minHint,
            onChanged: onChanged,
            suffixIcon: unit == null ? null : _UnitTag(unit!),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
          child: Text(
            '–',
            style: TextStyle(color: colors.inkMuted, fontSize: 18),
          ),
        ),
        Expanded(
          child: AppTextField(
            controller: max,
            hint: maxHint,
            onChanged: onChanged,
            suffixIcon: unit == null ? null : _UnitTag(unit!),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
        ),
      ],
    );
  }
}

/// A small muted unit token (ج.م / م²) shown inside a range field's suffix.
class _UnitTag extends StatelessWidget {
  const _UnitTag(this.unit);
  final String unit;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Align(
      alignment: Alignment.center,
      widthFactor: 1,
      child: Padding(
        padding: const EdgeInsetsDirectional.only(end: AppSpacing.md),
        child: Text(
          unit,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: colors.inkMuted,
                fontWeight: FontWeight.w600,
              ),
        ),
      ),
    );
  }
}
