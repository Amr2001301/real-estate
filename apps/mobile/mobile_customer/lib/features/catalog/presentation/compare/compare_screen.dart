import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/unit.dart';
import '../widgets/glass.dart';
import '../widgets/price_text.dart';
import '../widgets/unit_status_chip.dart';
import 'compare_cubit.dart';

/// Side-by-side comparison of the locally-selected units. Premium, mobile-first:
/// a horizontal row of compact unit columns with a navy header (project + remove)
/// and hairline-separated spec rows. Empty state routes to the Units tab in
/// compare-selection mode (a real tab switch, not a nested push).
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
            return EmptyState(
              icon: Icons.compare_arrows_rounded,
              title: l10n.compareEmptyTitle,
              message: l10n.compareEmptyMessage,
              action: AppButton(
                label: l10n.compareSelectUnits,
                icon: Icons.add_rounded,
                variant: AppButtonVariant.gold,
                // Real tab switch into the Units tab in compare-selection mode —
                // no nested route, navbar highlights Units.
                onPressed: () => context.go('/units?compare=true'),
              ),
            );
          }

          final bottomInset = MediaQuery.paddingOf(context).bottom;
          final dockClear = context.isApplePlatform ? bottomInset + 60 : 16.0;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // A gentle nudge to add a second unit when only one is selected.
              if (units.length < CompareCubit.minToCompare)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                      AppSpacing.lg, AppSpacing.md, AppSpacing.lg, 0),
                  child: _AddMoreHint(
                    text: l10n.compareAddAnother,
                    onTap: () => context.go('/units?compare=true'),
                  ),
                ),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: EdgeInsets.fromLTRB(
                      AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, dockClear),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final unit in units)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(
                              end: AppSpacing.md),
                          child: _CompareColumn(unit: unit),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// A soft gold hint card prompting the user to add a second unit.
class _AddMoreHint extends StatelessWidget {
  const _AddMoreHint({required this.text, required this.onTap});
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: colors.brandGoldSoft,
      borderRadius: BorderRadius.circular(AppRadii.md),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            children: [
              Icon(Icons.add_circle_outline_rounded,
                  size: 18, color: colors.brandGold),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  text,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              Icon(Icons.chevron_left_rounded, size: 20, color: colors.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}

/// One premium comparison column: navy header (project + remove) over a clean
/// stack of hairline-separated spec rows.
class _CompareColumn extends StatelessWidget {
  const _CompareColumn({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);
    final colors = context.appColors;

    return SizedBox(
      width: 230,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          boxShadow: colors.shadowCard,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Navy header: project + remove ──────────────────────────────
              DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppPalette.navy700, AppPalette.navy],
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(
                      AppSpacing.md, AppSpacing.sm, AppSpacing.xs, AppSpacing.sm),
                  child: Row(
                    children: [
                      const Icon(Icons.apartment_rounded,
                          size: 16, color: AppPalette.gold300),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: Text(
                          unit.project?.name.resolve(lang) ?? unit.type,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      _RemoveButton(
                        onTap: () =>
                            context.read<CompareCubit>().remove(unit.id),
                      ),
                    ],
                  ),
                ),
              ),
              // ── Body ───────────────────────────────────────────────────────
              Container(
                color: colors.surface,
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            unit.type,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: colors.inkStrong,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        UnitStatusChip(unit.status),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      l10n.unitCode(unit.code),
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: colors.inkMuted),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    PriceText(
                      unit.price,
                      style: theme.textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    const GoldHairline(),
                    const SizedBox(height: AppSpacing.xs),
                    _SpecRow(label: l10n.labelArea, value: l10n.areaValue('${unit.area}')),
                    _SpecRow(label: l10n.labelBedrooms, value: '${unit.bedrooms}'),
                    _SpecRow(label: l10n.labelBathrooms, value: '${unit.bathrooms}'),
                    if (unit.floor != null)
                      _SpecRow(label: l10n.labelFloor, value: '${unit.floor}'),
                    if (unit.project?.city.trim().isNotEmpty ?? false)
                      _SpecRow(
                          label: l10n.labelCity, value: unit.project!.city),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A label/value spec row with a hairline divider.
class _SpecRow extends StatelessWidget {
  const _SpecRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style:
                    theme.textTheme.labelSmall?.copyWith(color: colors.inkMuted),
              ),
              const Spacer(),
              Flexible(
                child: Text(
                  value,
                  textAlign: TextAlign.end,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Divider(height: 1, color: colors.hairline.withValues(alpha: 0.7)),
        ],
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
      color: Colors.white.withValues(alpha: 0.12),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Tooltip(
          message: context.l10n.compareRemove,
          child: const SizedBox(
            width: 30,
            height: 30,
            child: Icon(Icons.close_rounded, size: 16, color: Colors.white),
          ),
        ),
      ),
    );
  }
}
