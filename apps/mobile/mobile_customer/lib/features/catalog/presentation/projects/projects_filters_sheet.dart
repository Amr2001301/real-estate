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
                    label: _cityLabel(city),
                    selected: _f.city == city,
                    onTap: () => setState(() => _f = _f.copyWith(city: city)),
                  ),
              ],
            ),
          ),
        // Compact single-row toggle — no oversized card for one boolean.
        FilterSection(
          label: l10n.filterFeaturedOnly,
          icon: Icons.star_rounded,
          trailing: _MiniToggle(value: _f.featuredOnly),
          onTap: () => setState(
            () => _f = _f.copyWith(featuredOnly: !_f.featuredOnly),
          ),
        ),
        FilterSection(
          label: l10n.sortTitle,
          child: FilterChipGrid(
            items: [
              FilterChipItem(
                label: l10n.sortNewest,
                selected: _f.sort == ProjectSort.newest,
                onTap: () =>
                    setState(() => _f = _f.copyWith(sort: ProjectSort.newest)),
              ),
              FilterChipItem(
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

/// A small premium on/off switch (gold when on) for a one-line boolean filter.
class _MiniToggle extends StatelessWidget {
  const _MiniToggle({required this.value});
  final bool value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      width: 46,
      height: 28,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: value ? colors.brandGold : colors.surfaceSoft,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: value
              ? colors.brandGold
              : colors.hairline.withValues(alpha: 0.8),
        ),
      ),
      child: AnimatedAlign(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        alignment:
            value ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
        child: Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            color: value ? colors.brandNavy : colors.surface,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
