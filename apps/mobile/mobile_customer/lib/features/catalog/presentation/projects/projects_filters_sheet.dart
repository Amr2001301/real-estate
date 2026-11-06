import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/catalog_enums.dart';
import 'projects_state.dart';

/// Bottom sheet to edit project filters, in the staff app's look. Returns the
/// new filter on apply, or null if dismissed.
Future<ProjectsFilter?> showProjectsFilterSheet(
  BuildContext context, {
  required ProjectsFilter current,
  required List<String> cities,
}) {
  return showModalBottomSheet<ProjectsFilter>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
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

  /// Display-only Arabic normalization for obvious English city values; the
  /// backend value (used for filtering) is never changed.
  String _cityLabel(String raw) => switch (raw) {
        'Riyadh' => 'الرياض',
        'New Damietta' => 'دمياط الجديدة',
        _ => raw,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return FilterSheet(
      title: l10n.filtersTitle,
      active: _f.activeCount,
      applyLabel: l10n.applyFilters,
      onClear: () => Navigator.of(context).pop(const ProjectsFilter()),
      onApply: () => Navigator.of(context).pop(_f),
      sections: [
        if (widget.cities.isNotEmpty)
          FilterSection(
            icon: Icons.location_on_rounded,
            title: l10n.filterCity,
            child: FilterRadioList<String?>(
              keyPrefix: 'projects-city',
              selected: _f.city,
              onSelect: (v) => setState(() => _f = v == null ? _f.copyWith(clearCity: true) : _f.copyWith(city: v)),
              options: [
                FilterOption(null, l10n.filterAny),
                for (final c in widget.cities) FilterOption(c, _cityLabel(c)),
              ],
            ),
          ),
        FilterSection(
          icon: Icons.star_rounded,
          title: l10n.filterFeaturedOnly,
          child: FilterSegments<bool>(
            keyPrefix: 'projects-featured',
            selected: _f.featuredOnly,
            onSelect: (v) => setState(() => _f = _f.copyWith(featuredOnly: v)),
            options: [FilterOption(false, l10n.filterAny), FilterOption(true, l10n.filterFeaturedOnly)],
          ),
        ),
        FilterSection(
          icon: Icons.sort_rounded,
          title: l10n.sortTitle,
          child: FilterSegments<ProjectSort>(
            keyPrefix: 'projects-sort',
            selected: _f.sort,
            onSelect: (v) => setState(() => _f = _f.copyWith(sort: v)),
            options: [FilterOption(ProjectSort.newest, l10n.sortNewest), FilterOption(ProjectSort.oldest, l10n.sortOldest)],
          ),
        ),
      ],
    );
  }
}
