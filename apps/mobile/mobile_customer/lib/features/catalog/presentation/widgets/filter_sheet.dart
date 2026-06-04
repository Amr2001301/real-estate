import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Shared premium building blocks for the catalog filter bottom sheets
/// (projects + units) so both speak the same warm-luxe language: a rounded
/// cream/surface sheet, a header with a live active-count pill, gold-accented
/// section chips, and a pinned Reset / Apply footer. RTL-safe + dark-mode safe.

/// Presents [child] as a premium catalog filter sheet (surface fill, rounded
/// top, scroll-controlled so it grows with the keyboard).
Future<T?> showAppFilterSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    showDragHandle: false,
    backgroundColor: context.appColors.surface,
    clipBehavior: Clip.antiAlias,
    shape: const RoundedRectangleBorder(borderRadius: AppRadii.sheet),
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

    // Interleave sections with consistent vertical rhythm.
    final body = <Widget>[];
    for (var i = 0; i < sections.length; i++) {
      if (i > 0) body.add(const SizedBox(height: AppSpacing.lg));
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
            // Grabber.
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.hairline,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            // Header.
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.sm,
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
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    tooltip: MaterialLocalizations.of(context).closeButtonLabel,
                    icon: Icon(Icons.close_rounded, color: colors.inkMuted),
                    onPressed: () => Navigator.of(context).maybePop(),
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
            // Pinned footer (lifts above the keyboard).
            Container(
              decoration: BoxDecoration(
                color: colors.surface,
                border: Border(top: BorderSide(color: colors.hairline)),
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

/// A labelled filter section (header + content).
class FilterSection extends StatelessWidget {
  const FilterSection({super.key, required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.labelLarge?.copyWith(
            color: colors.inkStrong,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        child,
      ],
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
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

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
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 16, color: fg),
                const SizedBox(width: AppSpacing.xs),
              ],
              Text(
                label,
                style: theme.textTheme.labelLarge?.copyWith(
                  color: fg,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A min/max range row built from two premium [AppTextField]s with a separator
/// and an optional trailing unit (e.g. currency / م²).
class FilterRangeRow extends StatelessWidget {
  const FilterRangeRow({
    super.key,
    required this.min,
    required this.max,
    required this.minHint,
    required this.maxHint,
  });

  final TextEditingController min;
  final TextEditingController max;
  final String minHint;
  final String maxHint;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Expanded(
          child: AppTextField(
            controller: min,
            hint: minHint,
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
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
        ),
      ],
    );
  }
}
