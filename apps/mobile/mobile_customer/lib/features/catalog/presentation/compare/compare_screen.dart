import 'dart:math' as math;

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/unit.dart';
import '../widgets/unit_status_chip.dart';
import 'compare_cubit.dart';

/// Premium, mobile-first unit comparison — a single full-width **matrix**: navy
/// identity headers per unit over a cream card of attribute rows, with each
/// attribute (price, area, beds…) aligned across columns so values compare at a
/// glance. The best price (lowest) and area (largest) get a soft-gold cue. Fills
/// the width — no narrow side-scrolling columns, no large empty gutters.
class CompareScreen extends StatelessWidget {
  const CompareScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AdaptiveAppBar(
        title: Text(l10n.compareTitle),
        actions: [
          BlocBuilder<CompareCubit, List<Unit>>(
            builder: (context, units) => units.isEmpty
                ? const SizedBox.shrink()
                : TextButton(
                    onPressed: () => context.read<CompareCubit>().clear(),
                    child: Text(l10n.clearFilters),
                  ),
          ),
        ],
      ),
      body: BlocBuilder<CompareCubit, List<Unit>>(
        builder: (context, units) {
          if (units.isEmpty) {
            return const _CompareEmpty();
          }

          final bottomInset = MediaQuery.paddingOf(context).bottom;
          final dockClear = context.isApplePlatform ? bottomInset + 60 : 16.0;
          return SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, dockClear),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _CompareMatrix(units: units),
                // Add-unit affordance whenever there's room (< max). Doubles as
                // the "need a second unit" prompt and fills the lower space.
                if (units.length < CompareCubit.maxItems) ...[
                  const SizedBox(height: AppSpacing.lg),
                  if (units.length < CompareCubit.minToCompare) ...[
                    Text(
                      l10n.compareNeedMore,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: context.appColors.inkMuted,
                          ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                  _AddUnitButton(
                    text: l10n.compareAddUnit,
                    onTap: () => context.go('/units?compare=true'),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

/// The aligned identity-header + attribute-rows matrix.
class _CompareMatrix extends StatelessWidget {
  const _CompareMatrix({required this.units});
  final List<Unit> units;

  static const double _labelWidth = 66;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;

    // Best-value cues (only meaningful with ≥2 units).
    final compare = units.length >= 2;
    final prices =
        units.map((u) => num.tryParse(u.price)).whereType<num>();
    final num? minPrice =
        compare && prices.isNotEmpty ? prices.reduce(math.min) : null;
    final num? maxArea =
        compare ? units.map((u) => u.area).reduce(math.max) : null;

    String? floor(Unit u) => u.floor?.toString();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Identity header row (aligned with the padded body cells) ───────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
          // IntrinsicHeight bounds the vertical axis so the equal-height
          // (stretch) columns can lay out inside the scroll view.
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(width: _labelWidth - AppSpacing.sm),
                for (final u in units) Expanded(child: _IdentityCell(unit: u)),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        // ── Attribute rows card ────────────────────────────────────────────
        DecoratedBox(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: Border.all(color: colors.hairline.withValues(alpha: 0.8)),
            boxShadow: colors.shadowSoft,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.lg),
            child: Column(
              children: [
                _AttrRow(
                  label: l10n.filterStatus,
                  labelWidth: _labelWidth,
                  striped: false,
                  cells: [
                    for (final u in units)
                      Align(
                        alignment: Alignment.center,
                        child: UnitStatusChip(u.status),
                      ),
                  ],
                ),
                _AttrRow(
                  label: l10n.labelPrice,
                  labelWidth: _labelWidth,
                  striped: true,
                  cells: [
                    for (final u in units)
                      _PriceCell(
                        text: PriceFormatter.formatCompactString(
                          u.price,
                          languageCode: lang,
                        ),
                        best: minPrice != null &&
                            num.tryParse(u.price) == minPrice,
                      ),
                  ],
                ),
                _AttrRow(
                  label: l10n.labelArea,
                  labelWidth: _labelWidth,
                  striped: false,
                  cells: [
                    for (final u in units)
                      _ValueText(
                        l10n.areaValue('${u.area}'),
                        best: maxArea != null && u.area == maxArea,
                      ),
                  ],
                ),
                _AttrRow(
                  label: l10n.labelBedrooms,
                  labelWidth: _labelWidth,
                  striped: true,
                  cells: [for (final u in units) _ValueText('${u.bedrooms}')],
                ),
                _AttrRow(
                  label: l10n.labelBathrooms,
                  labelWidth: _labelWidth,
                  striped: false,
                  cells: [for (final u in units) _ValueText('${u.bathrooms}')],
                ),
                _AttrRow(
                  label: l10n.labelFloor,
                  labelWidth: _labelWidth,
                  striped: true,
                  cells: [for (final u in units) _ValueText(floor(u) ?? '—')],
                ),
                _AttrRow(
                  label: l10n.labelCity,
                  labelWidth: _labelWidth,
                  striped: false,
                  last: true,
                  cells: [
                    for (final u in units)
                      _ValueText(
                        (u.project?.city.trim().isNotEmpty ?? false)
                            ? u.project!.city
                            : '—',
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// A navy identity header for one unit column: project, type, code + remove ×.
class _IdentityCell extends StatelessWidget {
  const _IdentityCell({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);
    final project = unit.project?.name.resolve(lang).trim() ?? '';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadii.md),
        boxShadow: context.appColors.shadowSoft,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppPalette.navy700, AppPalette.navy],
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.xs, AppSpacing.xs, AppSpacing.xs, AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Remove control, pinned to the start edge.
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: _RemoveButton(
                    onTap: () => context.read<CompareCubit>().remove(unit.id),
                  ),
                ),
                if (project.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Text(
                      project,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: AppPalette.gold200,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                Text(
                  unit.type,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  unit.code,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.6),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One attribute row: a start-pinned label + one centered value cell per unit,
/// with a hairline divider and optional subtle striping.
class _AttrRow extends StatelessWidget {
  const _AttrRow({
    required this.label,
    required this.labelWidth,
    required this.cells,
    this.striped = false,
    this.last = false,
  });

  final String label;
  final double labelWidth;
  final List<Widget> cells;
  final bool striped;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: striped
            ? colors.surfaceSoft.withValues(alpha: 0.5)
            : Colors.transparent,
        border: last
            ? null
            : Border(
                bottom: BorderSide(
                    color: colors.hairline.withValues(alpha: 0.7)),
              ),
      ),
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm, vertical: AppSpacing.sm + 2),
      child: Row(
        children: [
          SizedBox(
            width: labelWidth - AppSpacing.sm,
            child: Text(
              label,
              maxLines: 2,
              style: theme.textTheme.labelSmall?.copyWith(
                color: colors.inkMuted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          for (final cell in cells)
            Expanded(child: Center(child: cell)),
        ],
      ),
    );
  }
}

/// A bold navy value, gold-emphasised when it's the "best" in its row.
class _ValueText extends StatelessWidget {
  const _ValueText(this.text, {this.best = false});
  final String text;
  final bool best;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final child = Text(
      text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      textAlign: TextAlign.center,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: best ? colors.brandGold : colors.inkStrong,
            fontWeight: FontWeight.w700,
          ),
    );
    if (!best) return child;
    return _GoldPill(child: child);
  }
}

/// The compact price value (gold), with a soft-gold pill when it's the lowest.
class _PriceCell extends StatelessWidget {
  const _PriceCell({required this.text, required this.best});
  final String text;
  final bool best;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final value = FittedBox(
      fit: BoxFit.scaleDown,
      child: Text(
        text,
        maxLines: 1,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: colors.brandGold,
              fontWeight: FontWeight.w800,
            ),
      ),
    );
    return best ? _GoldPill(child: value) : value;
  }
}

/// A soft-gold rounded background used to flag a "best" value cell.
class _GoldPill extends StatelessWidget {
  const _GoldPill({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 3),
      decoration: BoxDecoration(
        color: colors.brandGoldSoft,
        borderRadius: AppRadii.pillAll,
      ),
      child: child,
    );
  }
}

/// A full-width gold "add a unit" affordance (dashed/outline style) shown while
/// there's still room to add more units to the comparison.
class _AddUnitButton extends StatelessWidget {
  const _AddUnitButton({required this.text, required this.onTap});
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: colors.brandGoldSoft,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        side: BorderSide(color: colors.brandGold.withValues(alpha: 0.5)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.add_rounded, size: 20, color: colors.brandGold),
              const SizedBox(width: AppSpacing.xs),
              Text(
                text,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: colors.brandGold,
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Premium compare empty state: a "two properties" illustration, clear copy, a
/// compact how-it-works strip, and gold primary + outline browse actions.
class _CompareEmpty extends StatelessWidget {
  const _CompareEmpty();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final colors = context.appColors;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final dockClear = context.isApplePlatform ? bottomInset + 60 : 16.0;

    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
            AppSpacing.xl, AppSpacing.xl, AppSpacing.xl, dockClear),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const _CompareIllustration(),
            const SizedBox(height: AppSpacing.xxl),
            Text(
              l10n.compareEmptyTitle,
              textAlign: TextAlign.center,
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: colors.inkStrong,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.compareEmptyMessage,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: colors.inkMuted,
                height: 1.5,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            // How it works — three quick steps.
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _Step(
                  icon: Icons.touch_app_outlined,
                  label: l10n.compareStepSelect,
                ),
                const _StepArrow(),
                _Step(
                  icon: Icons.layers_outlined,
                  label: l10n.compareStepLimit,
                ),
                const _StepArrow(),
                _Step(
                  icon: Icons.compare_arrows_rounded,
                  label: l10n.compareStepCompare,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xxl),
            AppButton(
              label: l10n.compareSelectUnits,
              icon: Icons.add_rounded,
              variant: AppButtonVariant.gold,
              expand: true,
              onPressed: () => context.go('/units?compare=true'),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: l10n.compareBrowseUnits,
              icon: Icons.grid_view_rounded,
              variant: AppButtonVariant.outline,
              expand: true,
              onPressed: () => context.go('/units'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Two overlapping mini unit-cards (one navy, one cream) with a central gold
/// compare badge — an on-brand "compare two properties" motif.
class _CompareIllustration extends StatelessWidget {
  const _CompareIllustration();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 170,
      width: 230,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Soft gold halo behind the cards.
          Center(
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    context.appColors.brandGold.withValues(alpha: 0.14),
                    context.appColors.brandGold.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Align(
            alignment: const Alignment(-0.62, 0),
            child: Transform.rotate(
              angle: -0.14,
              child: const _MiniCard(navy: true),
            ),
          ),
          Align(
            alignment: const Alignment(0.62, 0),
            child: Transform.rotate(
              angle: 0.14,
              child: const _MiniCard(navy: false),
            ),
          ),
          const _CompareBadge(),
        ],
      ),
    );
  }
}

/// A stylised mini unit card used in the empty-state illustration.
class _MiniCard extends StatelessWidget {
  const _MiniCard({required this.navy});
  final bool navy;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final fg = navy ? Colors.white : colors.inkStrong;
    final line = (navy ? Colors.white : colors.inkMuted).withValues(alpha: 0.28);
    return Container(
      width: 104,
      height: 138,
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        gradient: navy
            ? const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppPalette.navy700, AppPalette.navy],
              )
            : null,
        color: navy ? null : colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: navy
            ? null
            : Border.all(color: colors.hairline.withValues(alpha: 0.9)),
        boxShadow: colors.shadowCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.apartment_rounded, size: 22, color: AppPalette.gold300),
          const Spacer(),
          for (var i = 0; i < 3; i++) ...[
            Container(
              height: 6,
              width: i == 0 ? 60 : (i == 1 ? 44 : 52),
              decoration: BoxDecoration(
                color: i == 0 ? AppPalette.gold400.withValues(alpha: 0.8) : line,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            if (i < 2) const SizedBox(height: 6),
          ],
          const SizedBox(height: 2),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: Icon(Icons.favorite_border_rounded, size: 12, color: fg.withValues(alpha: 0.5)),
          ),
        ],
      ),
    );
  }
}

/// The central gold compare badge.
class _CompareBadge extends StatelessWidget {
  const _CompareBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 58,
      height: 58,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppPalette.gold300, AppPalette.gold500],
        ),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.45),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: const Icon(Icons.compare_arrows_rounded,
          color: AppPalette.navy, size: 28),
    );
  }
}

/// One labelled step in the how-it-works strip.
class _Step extends StatelessWidget {
  const _Step({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: colors.brandGoldSoft,
            borderRadius: BorderRadius.circular(AppRadii.md),
            border: Border.all(color: colors.brandGold.withValues(alpha: 0.25)),
          ),
          child: Icon(icon, size: 20, color: colors.brandGold),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: colors.inkMuted,
                fontWeight: FontWeight.w600,
              ),
        ),
      ],
    );
  }
}

/// A muted directional connector between how-it-works steps.
class _StepArrow extends StatelessWidget {
  const _StepArrow();

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      child: Icon(
        rtl ? Icons.chevron_left_rounded : Icons.chevron_right_rounded,
        size: 20,
        color: context.appColors.hairline,
      ),
    );
  }
}

/// A small translucent remove (×) control on the navy column header.
class _RemoveButton extends StatelessWidget {
  const _RemoveButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.14),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Tooltip(
          message: context.l10n.compareRemove,
          child: const SizedBox(
            width: 26,
            height: 26,
            child: Icon(Icons.close_rounded, size: 15, color: Colors.white),
          ),
        ),
      ),
    );
  }
}
