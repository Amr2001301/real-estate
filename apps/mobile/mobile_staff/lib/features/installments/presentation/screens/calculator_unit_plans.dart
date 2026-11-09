import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../../catalog/domain/entities/staff_project.dart';
import '../../../catalog/domain/repositories/staff_catalog_repository.dart';
import '../../../contracts/create/contract_create_data.dart' show PickHit;
import '../../../contracts/create/manual_contract_screen.dart' show PickSheet;
import '../../domain/repositories/installments_repository.dart';

/// The calculator's first step, as the website's plan page: pick the project,
/// then one of its units; the unit's own payment plans come up with every
/// duration and its instalment. Choosing a duration hands the plan's figures
/// (price, booking, down payment, months, increase) to the calculator.
class CalculatorUnitPlans extends StatefulWidget {
  const CalculatorUnitPlans({
    super.key,
    required this.catalog,
    required this.installments,
    required this.onApply,
    required this.onUnitPrice,
    this.projectId,
    this.noPlansText,
    this.pickHint,
  });

  final StaffCatalogRepository catalog;
  final InstallmentsRepository installments;
  final String? projectId;

  /// What to say when a unit has no plans (the calculator says it can be done by hand).
  final String? noPlansText;

  /// A line under the pickers until a unit is chosen.
  final String? pickHint;

  /// A unit was chosen: its price, for the manual figures.
  final void Function(double price) onUnitPrice;

  /// A plan's duration was chosen: fill the calculator with its figures.
  final void Function(InstallmentOffer offer, InstallmentOfferOption option)
  onApply;

  @override
  State<CalculatorUnitPlans> createState() => _CalculatorUnitPlansState();
}

class _CalculatorUnitPlansState extends State<CalculatorUnitPlans> {
  List<StaffProject> _projects = const [];
  StaffProject? _project;
  List<StaffUnit> _units = const [];
  bool _loadingUnits = false;
  StaffUnit? _unit;
  List<InstallmentOffer> _offers = const [];
  bool _loadingOffers = false;
  int _plan = 0;
  int? _option;

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  Future<void> _loadProjects() async {
    final r = await widget.catalog.getProjects(search: null);
    if (!mounted) {
      return;
    }
    if (r case Ok(:final data)) {
      setState(() => _projects = data);
      final id = widget.projectId;
      if ((id ?? '').isNotEmpty) {
        final hit = data.where((p) => p.id == id).firstOrNull;
        if (hit != null) await _pickProject(hit);
      }
    }
  }

  Future<void> _pickProject(StaffProject p) async {
    setState(() {
      _project = p;
      _units = const [];
      _unit = null;
      _offers = const [];
      _loadingUnits = true;
    });
    final r = await widget.catalog.getProjectDetail(p.id);
    if (!mounted || _project?.id != p.id) return;
    setState(() {
      _loadingUnits = false;
      if (r case Ok(:final data)) {
        _units = [
          for (final u in data.units)
            if (u.status == 'AVAILABLE') u,
        ];
      }
    });
  }

  Future<void> _pickUnit(StaffUnit u) async {
    final project = _project;
    if (project == null) {
      return;
    }
    setState(() {
      _unit = u;
      _offers = const [];
      _plan = 0;
      _option = null;
      _loadingOffers = true;
    });
    final price = double.tryParse(u.price ?? '');
    if (price != null && price > 0) {
      widget.onUnitPrice(price);
    }
    final r = await widget.installments.unitOffers(
      projectId: project.id,
      unitId: u.id,
    );
    if (!mounted || _unit?.id != u.id) return;
    setState(() {
      _loadingOffers = false;
      if (r case Ok(:final data)) _offers = data;
    });
    if (_offers.isNotEmpty) _selectPlan(0);
  }

  void _selectPlan(int i) {
    final offer = _offers[i];
    final first = offer.options.isEmpty ? null : 0;
    setState(() {
      _plan = i;
      _option = first;
    });
    if (first != null) widget.onApply(offer, offer.options[first]);
  }

  void _selectOption(int i) {
    final offer = _offers[_plan];
    setState(() => _option = i);
    widget.onApply(offer, offer.options[i]);
  }

  Future<void> _sheetProject() async {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final hit = await showModalBottomSheet<PickHit>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PickSheet(
        title: l10n.rnPickProject,
        hint: l10n.rnPickProject,
        keyPrefix: 'calc-project',
        search: (q) async => [
          for (final p in _projects)
            if (q.trim().isEmpty || p.name.resolve(lang).contains(q.trim()))
              PickHit(p.id, p.name.resolve(lang), p.city),
        ],
      ),
    );
    if (hit == null) {
      return;
    }
    final p = _projects.where((p) => p.id == hit.id).firstOrNull;
    if (p != null) await _pickProject(p);
  }

  Future<void> _sheetUnit() async {
    final l10n = context.l10n;
    final hit = await showModalBottomSheet<PickHit>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PickSheet(
        title: l10n.rnPickUnit,
        hint: l10n.rnSearchUnit,
        keyPrefix: 'calc-unit',
        search: (q) async => [
          for (final u in _units)
            if (q.trim().isEmpty ||
                u.code.toLowerCase().contains(q.trim().toLowerCase()))
              PickHit(u.id, u.code, null, double.tryParse(u.price ?? '')),
        ],
      ),
    );
    if (hit == null) {
      return;
    }
    final u = _units.where((u) => u.id == hit.id).firstOrNull;
    if (u != null) await _pickUnit(u);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: homeCard(context, radius: 24),
          child: Column(
            children: [
              _PickRow(
                key: const Key('calc-pick-project'),
                icon: Icons.apartment_rounded,
                label: l10n.calculatorProject,
                value: _project?.name.resolve(lang),
                placeholder: l10n.rnPickProject,
                onTap: _projects.isEmpty ? null : _sheetProject,
              ),
              const SizedBox(height: 8),
              _PickRow(
                key: const Key('calc-pick-unit'),
                icon: Icons.home_work_rounded,
                label: l10n.calculatorUnit,
                value: _unit == null
                    ? null
                    : '${ltrRuns(_unit!.code)}${_unit!.price == null ? '' : '  ·  ${money(double.tryParse(_unit!.price!) ?? 0)}'}',
                placeholder: l10n.rnPickUnit,
                busy: _loadingUnits,
                onTap: _project == null || _units.isEmpty ? null : _sheetUnit,
              ),
            ],
          ),
        ),
        if (_unit == null && widget.pickHint != null)
          Padding(
            key: const Key('plans-pick-hint'),
            padding: const EdgeInsets.only(top: 12),
            child: Text(widget.pickHint!, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
          ),
        if (_loadingOffers)
          const Padding(
            padding: EdgeInsets.all(20),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2.5)),
          )
        else if (_unit != null && _offers.isEmpty)
          Padding(
            key: const Key('calc-no-plans'),
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              widget.noPlansText ?? l10n.calculatorNoPlans,
              style: TextStyle(fontSize: 12.5, color: colors.inkMuted),
            ),
          )
        else if (_offers.isNotEmpty) ...[
          const SizedBox(height: 12),
          for (var i = 0; i < _offers.length; i++) ...[
            _PlanCard(
              key: Key('calc-plan-$i'),
              offer: _offers[i],
              selected: i == _plan,
              money: money,
              onTap: () => _selectPlan(i),
            ),
            if (i == _plan && _offers[i].options.isNotEmpty)
              _Durations(
                offer: _offers[i],
                selected: _option,
                money: money,
                onPick: _selectOption,
              ),
            const SizedBox(height: 8),
          ],
        ],
      ],
    );
  }
}

class _PickRow extends StatelessWidget {
  const _PickRow({
    super.key,
    required this.icon,
    required this.label,
    required this.placeholder,
    required this.onTap,
    this.value,
    this.busy = false,
  });
  final IconData icon;
  final String label;
  final String placeholder;
  final String? value;
  final bool busy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: colors.hairline),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          child: Row(
            children: [
              Icon(icon, size: 20, color: AppPalette.gold600),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: colors.inkMuted,
                      ),
                    ),
                    Text(
                      value ?? placeholder,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                        color: value == null
                            ? colors.inkMuted
                            : colors.inkStrong,
                      ),
                    ),
                  ],
                ),
              ),
              if (busy)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                Icon(Icons.keyboard_arrow_down_rounded, color: colors.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    super.key,
    required this.offer,
    required this.selected,
    required this.money,
    required this.onTap,
  });
  final InstallmentOffer offer;
  final bool selected;
  final String Function(double) money;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return Material(
      color: selected ? homeSelected(context) : colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(
          color: selected ? AppPalette.navy : colors.hairline,
          width: selected ? 1.6 : 1.2,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      ltrRuns(offer.name),
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                        color: colors.inkStrong,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      offer.isCash
                          ? l10n.calculatorCashPlan
                          : l10n.calculatorPlanUpfront(money(offer.upfront)),
                      style: TextStyle(fontSize: 12, color: colors.inkMuted),
                    ),
                  ],
                ),
              ),
              Text(
                money(offer.netPrice),
                style: homeDisplay(15, colors.inkStrong),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Durations extends StatelessWidget {
  const _Durations({
    required this.offer,
    required this.selected,
    required this.money,
    required this.onPick,
  });
  final InstallmentOffer offer;
  final int? selected;
  final String Function(double) money;
  final ValueChanged<int> onPick;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(top: 6, left: 6, right: 6),
      child: Column(
        children: [
          for (var i = 0; i < offer.options.length; i++)
            Builder(
              builder: (_) {
                final o = offer.options[i];
                final on = i == selected;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Material(
                    color: on ? AppPalette.navy : colors.surface,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(
                        color: on ? AppPalette.navy : colors.hairline,
                      ),
                    ),
                    child: InkWell(
                      key: Key('calc-duration-$i'),
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => onPick(i),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        child: Row(
                          children: [
                            Text(
                              l10n.planTemplatesMonths(o.durationMonths),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: on ? Colors.white : colors.inkStrong,
                              ),
                            ),
                            if (o.increasePercentage > 0) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 7,
                                  vertical: 1,
                                ),
                                decoration: BoxDecoration(
                                  color: on
                                      ? AppPalette.gold400
                                      : AppPalette.gold50,
                                  borderRadius: BorderRadius.circular(99),
                                ),
                                child: Text(
                                  '\u2066+${percentText(o.increasePercentage)}%\u2069',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    color: on
                                        ? AppPalette.navy
                                        : AppPalette.gold600,
                                  ),
                                ),
                              ),
                            ],
                            const Spacer(),
                            Text(
                              l10n.calculatorPerMonth(money(o.amount)),
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w800,
                                color: on
                                    ? AppPalette.gold300
                                    : colors.inkStrong,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
