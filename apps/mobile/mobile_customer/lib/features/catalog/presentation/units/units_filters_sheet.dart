import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/catalog_enums.dart';
import 'units_state.dart';

Future<UnitsFilter?> showUnitsFilterSheet(
  BuildContext context, {
  required UnitsFilter current,
}) {
  return showModalBottomSheet<UnitsFilter>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
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
    final theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.sm,
        bottom: MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.filtersTitle, style: theme.textTheme.titleLarge),
            const SizedBox(height: AppSpacing.lg),

            Text(l10n.filterStatus, style: theme.textTheme.labelLarge),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.xs,
              children: [
                ChoiceChip(
                  label: Text(l10n.filterAny),
                  selected: _f.status == null,
                  onSelected: (_) =>
                      setState(() => _f = _f.copyWith(clearStatus: true)),
                ),
                for (final s in [UnitStatus.available, UnitStatus.reserved, UnitStatus.sold])
                  ChoiceChip(
                    label: Text(_statusLabel(l10n, s)),
                    selected: _f.status == s,
                    onSelected: (_) => setState(() => _f = _f.copyWith(status: s)),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),

            Text(l10n.filterRooms, style: theme.textTheme.labelLarge),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.xs,
              children: [
                ChoiceChip(
                  label: Text(l10n.filterAny),
                  selected: _f.bedrooms == null,
                  onSelected: (_) =>
                      setState(() => _f = _f.copyWith(clearBedrooms: true)),
                ),
                for (final n in [1, 2, 3, 4])
                  ChoiceChip(
                    label: Text('$n${n == 4 ? '+' : ''}'),
                    selected: _f.bedrooms == n,
                    onSelected: (_) => setState(() => _f = _f.copyWith(bedrooms: n)),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),

            Text(l10n.filterPriceRange, style: theme.textTheme.labelLarge),
            const SizedBox(height: AppSpacing.xs),
            _rangeRow(l10n, _priceMin, _priceMax),
            const SizedBox(height: AppSpacing.lg),

            Text(l10n.filterAreaRange, style: theme.textTheme.labelLarge),
            const SizedBox(height: AppSpacing.xs),
            _rangeRow(l10n, _areaMin, _areaMax),
            const SizedBox(height: AppSpacing.lg),

            Text(l10n.sortTitle, style: theme.textTheme.labelLarge),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
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
            const SizedBox(height: AppSpacing.xl),

            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: l10n.clearFilters,
                    variant: AppButtonVariant.outline,
                    onPressed: () =>
                        Navigator.of(context).pop(const UnitsFilter()),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: AppButton(
                    label: l10n.applyFilters,
                    onPressed: () => Navigator.of(context).pop(_collect()),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _sortChip(String label, UnitSort sort) => ChoiceChip(
        label: Text(label),
        selected: _f.sort == sort,
        onSelected: (_) => setState(() => _f = _f.copyWith(sort: sort)),
      );

  Widget _rangeRow(
    AppLocalizations l10n,
    TextEditingController min,
    TextEditingController max,
  ) {
    return Row(
      children: [
        Expanded(
          child: AppTextField(
            controller: min,
            hint: l10n.minLabel,
            keyboardType: TextInputType.number,
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: AppTextField(
            controller: max,
            hint: l10n.maxLabel,
            keyboardType: TextInputType.number,
          ),
        ),
      ],
    );
  }

  String _statusLabel(AppLocalizations l10n, UnitStatus s) => switch (s) {
        UnitStatus.available => l10n.statusAvailable,
        UnitStatus.reserved => l10n.statusReserved,
        UnitStatus.sold => l10n.statusSold,
        UnitStatus.unknown => '',
      };
}
