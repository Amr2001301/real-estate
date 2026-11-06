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
    backgroundColor: Colors.transparent,
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
  late final _areaMin = TextEditingController(text: _txt(_f.areaMin));
  late final _areaMax = TextEditingController(text: _txt(_f.areaMax));

  String _txt(num? v) => v == null ? '' : '$v';

  @override
  void dispose() {
    _areaMin.dispose();
    _areaMax.dispose();
    super.dispose();
  }

  UnitsFilter _collect() => _f.copyWith(
        areaMin: num.tryParse(_areaMin.text),
        areaMax: num.tryParse(_areaMax.text),
        clearArea: _areaMin.text.isEmpty && _areaMax.text.isEmpty,
      );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final symbol = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    return FilterSheet(
      title: l10n.filtersTitle,
      active: _f.activeCount,
      applyLabel: l10n.applyFilters,
      onClear: () => Navigator.of(context).pop(const UnitsFilter()),
      onApply: () => Navigator.of(context).pop(_collect()),
      sections: [
        FilterSection(
          icon: Icons.flag_rounded,
          title: l10n.filterStatus,
          child: FilterSegments<UnitStatus?>(
            keyPrefix: 'units-status',
            selected: _f.status,
            onSelect: (v) => setState(() => _f = v == null ? _f.copyWith(clearStatus: true) : _f.copyWith(status: v)),
            options: [
              FilterOption(null, l10n.filterAny),
              for (final s in const [UnitStatus.available, UnitStatus.reserved, UnitStatus.sold]) FilterOption(s, _statusLabel(l10n, s)),
            ],
          ),
        ),
        FilterSection(
          icon: Icons.bed_rounded,
          title: l10n.filterRooms,
          child: FilterSegments<int?>(
            keyPrefix: 'units-rooms',
            selected: _f.bedrooms,
            onSelect: (v) => setState(() => _f = v == null ? _f.copyWith(clearBedrooms: true) : _f.copyWith(bedrooms: v)),
            options: [FilterOption(null, l10n.filterAny), for (final n in const [1, 2, 3, 4]) FilterOption(n, ltr('$n${n == 4 ? '+' : ''}'))],
          ),
        ),
        FilterSection(
          icon: Icons.payments_rounded,
          title: l10n.filterPriceRange,
          hint: symbol,
          child: FilterPriceRange(
            from: _f.priceMin,
            to: _f.priceMax,
            onChanged: (a, b) => setState(() {
              _f = _f.copyWith(priceMin: a, priceMax: b, clearPrice: a == null && b == null);
            }),
          ),
        ),
        FilterSection(
          icon: Icons.square_foot_rounded,
          title: l10n.filterAreaRange,
          hint: l10n.filterAreaUnit,
          child: Row(children: [
            Expanded(child: _AreaField(controller: _areaMin, hint: l10n.minLabel)),
            const SizedBox(width: 10),
            Expanded(child: _AreaField(controller: _areaMax, hint: l10n.maxLabel)),
          ]),
        ),
        FilterSection(
          icon: Icons.sort_rounded,
          title: l10n.sortTitle,
          child: FilterRadioList<UnitSort>(
            keyPrefix: 'units-sort',
            selected: _f.sort,
            onSelect: (v) => setState(() => _f = _f.copyWith(sort: v)),
            options: [
              FilterOption(UnitSort.newest, l10n.sortNewest),
              FilterOption(UnitSort.priceAsc, l10n.sortPriceAsc),
              FilterOption(UnitSort.priceDesc, l10n.sortPriceDesc),
              FilterOption(UnitSort.areaAsc, l10n.sortAreaAsc),
              FilterOption(UnitSort.areaDesc, l10n.sortAreaDesc),
            ],
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

class _AreaField extends StatelessWidget {
  const _AreaField({required this.controller, required this.hint});
  final TextEditingController controller;
  final String hint;

  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        keyboardType: TextInputType.number,
        decoration: InputDecoration(
          hintText: hint,
          filled: true,
          fillColor: Colors.white,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFECE4D6))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFECE4D6))),
        ),
      );
}
