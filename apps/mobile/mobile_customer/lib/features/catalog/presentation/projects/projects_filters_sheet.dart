import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/catalog_enums.dart';
import '../widgets/filter_sheet.dart';
import 'projects_state.dart';

/// Bottom sheet to edit project filters. Returns the new filter on apply, or
/// null if dismissed.
Future<ProjectsFilter?> showProjectsFilterSheet(
  BuildContext context, {
  required ProjectsFilter current,
  required List<String> cities,
}) {
  return showAppFilterSheet<ProjectsFilter>(
    context,
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

    return FilterSheetShell(
      title: l10n.filtersTitle,
      activeCount: _f.activeCount,
      applyLabel: l10n.applyFilters,
      resetLabel: l10n.clearFilters,
      onReset: () => Navigator.of(context).pop(const ProjectsFilter()),
      onApply: () => Navigator.of(context).pop(_f),
      sections: [
        if (widget.cities.isNotEmpty)
          FilterSection(
            label: l10n.filterCity,
            child: Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                FilterChoiceChip(
                  label: l10n.filterAny,
                  selected: _f.city == null,
                  onTap: () =>
                      setState(() => _f = _f.copyWith(clearCity: true)),
                ),
                for (final city in widget.cities)
                  FilterChoiceChip(
                    label: city,
                    selected: _f.city == city,
                    onTap: () => setState(() => _f = _f.copyWith(city: city)),
                  ),
              ],
            ),
          ),
        FilterSection(
          label: l10n.filterFeaturedOnly,
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: FilterChoiceChip(
              label: l10n.filterFeaturedOnly,
              icon: Icons.star_rounded,
              selected: _f.featuredOnly,
              onTap: () => setState(
                () => _f = _f.copyWith(featuredOnly: !_f.featuredOnly),
              ),
            ),
          ),
        ),
        FilterSection(
          label: l10n.sortTitle,
          child: Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              FilterChoiceChip(
                label: l10n.sortNewest,
                selected: _f.sort == ProjectSort.newest,
                onTap: () =>
                    setState(() => _f = _f.copyWith(sort: ProjectSort.newest)),
              ),
              FilterChoiceChip(
                label: l10n.sortOldest,
                selected: _f.sort == ProjectSort.oldest,
                onTap: () =>
                    setState(() => _f = _f.copyWith(sort: ProjectSort.oldest)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
