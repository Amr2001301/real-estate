import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/catalog_enums.dart';
import '../widgets/filter_sheet.dart';
import 'units_state.dart';

Future<UnitsFilter?> showUnitsFilterSheet(
  BuildContext context, {
  required UnitsFilter current,
}) {
  return showAppFilterSheet<UnitsFilter>(
    context,
    builder: (_) => _UnitsFilterSheet(initial: current),
  );
}

class _UnitsFilterSheet extends StatefulWidget {
  const _UnitsFilterSheet({required this.initial});
  final UnitsFilter initial;

  @override
  State<_UnitsFilterSheet> createState() => _UnitsFilterSheetState();
}

class _UnitsFilterSheetState extends State<_UnitsFilterSheet> {
  late UnitsFilter _f = widget.initial;
  late final _priceMin = TextEditingController(text: _txt(_f.priceMin));
  late final _priceMax = TextEditingController(text: _txt(_f.priceMax));
  late final _areaMin = TextEditingController(text: _txt(_f.areaMin));
  late final _areaMax = TextEditingController(text: _txt(_f.areaMax));

  String _txt(num? v) => v == null ? '' : '$v';

  @override
  void dispose() {
    _priceMin.dispose();
    _priceMax.dispose();
    _areaMin.dispose();
    _areaMax.dispose();
    super.dispose();
  }

  UnitsFilter _collect() {
    return _f.copyWith(
      priceMin: num.tryParse(_priceMin.text),
      priceMax: num.tryParse(_priceMax.text),
      areaMin: num.tryParse(_areaMin.text),
      areaMax: num.tryParse(_areaMax.text),
      clearPrice: _priceMin.text.isEmpty && _priceMax.text.isEmpty,
      clearArea: _areaMin.text.isEmpty && _areaMax.text.isEmpty,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return FilterSheetShell(
      title: l10n.filtersTitle,
      activeCount: _f.activeCount,
      applyLabel: l10n.applyFilters,
      resetLabel: l10n.clearFilters,
      onReset: () => Navigator.of(context).pop(const UnitsFilter()),
      onApply: () => Navigator.of(context).pop(_collect()),
      sections: [
        FilterSection(
          label: l10n.filterStatus,
          child: Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              FilterChoiceChip(
                label: l10n.filterAny,
                selected: _f.status == null,
                onTap: () =>
                    setState(() => _f = _f.copyWith(clearStatus: true)),
              ),
              for (final s in const [
                UnitStatus.available,
                UnitStatus.reserved,
                UnitStatus.sold,
              ])
                FilterChoiceChip(
                  label: _statusLabel(l10n, s),
                  selected: _f.status == s,
                  onTap: () => setState(() => _f = _f.copyWith(status: s)),
                ),
            ],
          ),
        ),
        FilterSection(
          label: l10n.filterRooms,
          child: Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              FilterChoiceChip(
                label: l10n.filterAny,
                selected: _f.bedrooms == null,
                onTap: () =>
                    setState(() => _f = _f.copyWith(clearBedrooms: true)),
              ),
              for (final n in const [1, 2, 3, 4])
                FilterChoiceChip(
                  label: '$n${n == 4 ? '+' : ''}',
                  selected: _f.bedrooms == n,
                  onTap: () => setState(() => _f = _f.copyWith(bedrooms: n)),
                ),
            ],
          ),
        ),
        FilterSection(
          label: l10n.filterPriceRange,
          child: FilterRangeRow(
            min: _priceMin,
            max: _priceMax,
            minHint: l10n.minLabel,
            maxHint: l10n.maxLabel,
          ),
        ),
        FilterSection(
          label: l10n.filterAreaRange,
          child: FilterRangeRow(
            min: _areaMin,
            max: _areaMax,
            minHint: l10n.minLabel,
            maxHint: l10n.maxLabel,
          ),
        ),
        FilterSection(
          label: l10n.sortTitle,
          child: Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _sortChip(l10n.sortNewest, UnitSort.newest),
              _sortChip(l10n.sortPriceAsc, UnitSort.priceAsc),
              _sortChip(l10n.sortPriceDesc, UnitSort.priceDesc),
              _sortChip(l10n.sortAreaAsc, UnitSort.areaAsc),
              _sortChip(l10n.sortAreaDesc, UnitSort.areaDesc),
            ],
          ),
        ),
      ],
    );
  }

  Widget _sortChip(String label, UnitSort sort) => FilterChoiceChip(
        label: label,
        selected: _f.sort == sort,
        onTap: () => setState(() => _f = _f.copyWith(sort: sort)),
      );

  String _statusLabel(AppLocalizations l10n, UnitStatus s) => switch (s) {
        UnitStatus.available => l10n.statusAvailable,
        UnitStatus.reserved => l10n.statusReserved,
        UnitStatus.sold => l10n.statusSold,
        UnitStatus.unknown => '',
      };
}
