import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/unit.dart';
import '../widgets/price_text.dart';
import '../widgets/unit_status_chip.dart';
import 'compare_cubit.dart';

/// Side-by-side comparison of locally-selected units.
class CompareScreen extends StatelessWidget {
  const CompareScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(
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
                label: l10n.compareAddUnits,
                icon: Icons.add_rounded,
                variant: AppButtonVariant.gold,
                // Opens the global units list (full-screen over the shell);
                // the user adds units from a unit's detail, then returns here.
                onPressed: () => context.push('/units'),
              ),
            );
          }
          return SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final unit in units)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: AppSpacing.md),
                    child: _CompareColumn(unit: unit),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _CompareColumn extends StatelessWidget {
  const _CompareColumn({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);

    return SizedBox(
      width: 220,
      child: AppCard(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    unit.project?.name.resolve(lang) ?? unit.type,
                    style: theme.textTheme.titleSmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.close_rounded, size: 18),
                  onPressed: () => context.read<CompareCubit>().remove(unit.id),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            UnitStatusChip(unit.status),
            const Divider(height: AppSpacing.lg),
            _row(context, l10n.labelPrice, null, child: PriceText(unit.price)),
            _row(context, l10n.labelType, unit.type),
            _row(context, l10n.labelArea, l10n.areaValue('${unit.area}')),
            _row(context, l10n.labelBedrooms, '${unit.bedrooms}'),
            _row(context, l10n.labelBathrooms, '${unit.bathrooms}'),
            if (unit.floor != null) _row(context, l10n.labelFloor, '${unit.floor}'),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, String? value, {Widget? child}) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: theme.textTheme.labelSmall?.copyWith(color: colors.inkMuted)),
          const SizedBox(height: 2),
          child ?? Text(value ?? '—', style: theme.textTheme.bodyMedium),
        ],
      ),
    );
  }
}
