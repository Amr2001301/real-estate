import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/catalog_enums.dart';
import 'projects_state.dart';

/// Bottom sheet to edit project filters. Returns the new filter on apply, or
/// null if dismissed.
Future<ProjectsFilter?> showProjectsFilterSheet(
  BuildContext context, {
  required ProjectsFilter current,
  required List<String> cities,
}) {
  return showModalBottomSheet<ProjectsFilter>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _ProjectsFilterSheet(initial: current, cities: cities),
  );
}

class _ProjectsFilterSheet extends StatefulWidget {
  const _ProjectsFilterSheet({required this.initial, required this.cities});
  final ProjectsFilter initial;
  final List<String> cities;

  @override
  State<_ProjectsFilterSheet> createState() => _ProjectsFilterSheetState();
}

class _ProjectsFilterSheetState extends State<_ProjectsFilterSheet> {
  late ProjectsFilter _f = widget.initial;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.sm,
        bottom: MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.filtersTitle, style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.lg),

          if (widget.cities.isNotEmpty) ...[
            Text(l10n.filterCity, style: theme.textTheme.labelLarge),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                ChoiceChip(
                  label: Text(l10n.filterAny),
                  selected: _f.city == null,
                  onSelected: (_) =>
                      setState(() => _f = _f.copyWith(clearCity: true)),
                ),
                for (final city in widget.cities)
                  ChoiceChip(
                    label: Text(city),
                    selected: _f.city == city,
                    onSelected: (_) =>
                        setState(() => _f = _f.copyWith(city: city)),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
          ],

          SwitchListTile.adaptive(
            value: _f.featuredOnly,
            onChanged: (v) => setState(() => _f = _f.copyWith(featuredOnly: v)),
            title: Text(l10n.filterFeaturedOnly),
            contentPadding: EdgeInsets.zero,
            activeThumbColor: context.appColors.brandGold,
          ),

          const SizedBox(height: AppSpacing.sm),
          Text(l10n.sortTitle, style: theme.textTheme.labelLarge),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            children: [
              ChoiceChip(
                label: Text(l10n.sortNewest),
                selected: _f.sort == ProjectSort.newest,
                onSelected: (_) =>
                    setState(() => _f = _f.copyWith(sort: ProjectSort.newest)),
              ),
              ChoiceChip(
                label: Text(l10n.sortOldest),
                selected: _f.sort == ProjectSort.oldest,
                onSelected: (_) =>
                    setState(() => _f = _f.copyWith(sort: ProjectSort.oldest)),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),

          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: l10n.clearFilters,
                  variant: AppButtonVariant.outline,
                  onPressed: () => Navigator.of(context).pop(
                    const ProjectsFilter(),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppButton(
                  label: l10n.applyFilters,
                  onPressed: () => Navigator.of(context).pop(_f),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
