import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../dashboard/home_kit/filter_kit.dart';
import '../../dashboard/home_kit/home_kit.dart';
import '../domain/ledger.dart';
import 'ledger_labels.dart';

/// «ليا وعليا» — the dashboard's «المستحقات والالتزامات» on the phone: the
/// same API, so the same numbers. Admin, or `reports:financial:read`.
class LedgerScreen extends StatefulWidget {
  const LedgerScreen({super.key});

  @override
  State<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends State<LedgerScreen> {
  LedgerPeriod _period = LedgerPeriod.all;
  DateTime? _today;
  Result<LedgerSummary>? _result;

  @override
  void initState() {
    super.initState();
    _load();
  }

  ({String? dateFrom, String? dateTo}) get _range =>
      _today == null ? (dateFrom: null, dateTo: null) : ledgerPeriodRange(_period, _today!);

  Future<void> _load() async {
    setState(() => _result = null);
    final r = _range;
    final res = await context.read<LedgerRepository>().summary(dateFrom: r.dateFrom, dateTo: r.dateTo);
    if (!mounted) return;
    setState(() {
      _result = res;
      if (res case Ok(:final data)) _today ??= data.asOf;
    });
  }

  void _filters() {
    showFilterSheet(
      context,
      (_) => _PeriodSheet(
        selected: _period,
        enabled: _today != null,
        onApply: (p) {
          setState(() => _period = p);
          _load();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final r = _result;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('ledger'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 32),
            children: [
              HomeListHero(
                back: true,
                title: l10n.ledgerTitle,
                subtitle: switch (r) {
                  Ok(:final data) => '${l10n.statementAsOf(DateFormatter.mediumDate(data.asOf, languageCode: lang))}${_period == LedgerPeriod.all ? '' : ' · ${ledgerPeriodLabel(l10n, _period)}'}',
                  _ => l10n.ledgerSubtitle,
                },
                actions: [
                  HomeHeroButton(
                    key: const Key('ledger-filters'),
                    icon: Icons.tune_rounded,
                    dot: _period != LedgerPeriod.all,
                    tooltip: l10n.ledgerFilterTitle,
                    onTap: _filters,
                  ),
                ],
              ),
              ...switch (r) {
                null => [const SizedBox(height: 300, child: Center(child: CircularProgressIndicator()))],
                Err(:final failure) => [ErrorState(failure: failure, onRetry: _load)],
                Ok(:final data) => _body(context, data),
              },
            ],
          ),
        ),
      ),
    );
  }

  /// The groups that have items as cards; the empty ones in one quiet line.
  Widget _groups(BuildContext context, LedgerSummary s, {required bool receivable}) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final all = LedgerGroup.values.where((g) => g.receivable == receivable);
    LedgerFigure fig(LedgerGroup g) => s.groups[g] ?? const LedgerFigure(amount: 0, count: 0);
    final empty = [for (final g in all) if (fig(g).count == 0) ledgerGroupTitle(l10n, g)];
    return Column(children: [
      for (final g in all)
        if (fig(g).count > 0) _GroupCard(group: g, figure: fig(g), range: _range),
      if (empty.isNotEmpty)
        Padding(
          key: Key('ledger-empty-${receivable ? 'in' : 'out'}'),
          padding: const EdgeInsets.fromLTRB(4, 2, 4, 0),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.check_circle_outline_rounded, size: 16, color: colors.inkMuted),
            const SizedBox(width: 6),
            Expanded(child: Text(l10n.ledgerNoItemsIn(empty.join(' · ')), style: TextStyle(fontSize: 12, height: 1.5, color: colors.inkMuted))),
          ]),
        ),
    ]);
  }

  List<Widget> _body(BuildContext context, LedgerSummary s) {
    final l10n = context.l10n;
    final netPositive = s.net >= 0;
    HomeFigure fig(String id, double v, String label, String hint, {bool warn = false}) {
      final (n, u) = homeCompact(v, l10n);
      return HomeFigure(id: id, value: ltr(n), label: u.isEmpty ? label : '$label · $u', hint: hint, warn: warn);
    }

    int items(bool receivable) => LedgerGroup.values.where((g) => g.receivable == receivable).fold(0, (a, g) => a + (s.groups[g]?.count ?? 0));
    return [
      Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
        child: HomeBand(figures: [
          fig('net', s.net.abs(), l10n.ledgerNet, netPositive ? l10n.ledgerNetForCompany : l10n.ledgerNetOnCompany, warn: !netPositive),
          fig('receivables', s.receivables, l10n.ledgerReceivables, l10n.ledgerItems(items(true))),
          fig('payables', s.payables, l10n.ledgerPayables, l10n.ledgerItems(items(false))),
        ]),
      ),
      HomeSection(
        icon: Icons.south_west_rounded,
        title: l10n.ledgerReceivablesTitle,
        child: _groups(context, s, receivable: true),
      ),
      HomeSection(
        icon: Icons.north_east_rounded,
        title: l10n.ledgerPayablesTitle,
        child: _groups(context, s, receivable: false),
      ),
    ];
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group, required this.figure, required this.range});
  final LedgerGroup group;
  final LedgerFigure figure;
  final ({String? dateFrom, String? dateTo}) range;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    String money(double v) => PriceFormatter.format(v.roundToDouble(), languageCode: lang);
    final states = LedgerState.values.where((s) => (figure.states[s]?.amount ?? 0) > 0).toList();
    final total = states.fold<double>(0, (a, st) => a + figure.states[st]!.amount);
    final late = figure.states[LedgerState.late]?.amount ?? 0;
    final open = figure.count > 0;
    final receivable = group.receivable;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24), side: BorderSide(color: colors.hairline)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          key: Key('ledger-group-${group.wire}'),
          onTap: open ? () => context.push('/ledger/${group.wire}', extra: (dateFrom: range.dateFrom, dateTo: range.dateTo)) : null,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    gradient: receivable ? homeGoldGradient : homeNavyGradient,
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: Icon(ledgerGroupIcon(group), size: 23, color: receivable ? AppPalette.navy : AppPalette.gold300),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(ledgerGroupTitle(l10n, group), style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                    const SizedBox(height: 3),
                    Row(children: [
                      Text(l10n.ledgerItems(figure.count), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                      if (group == LedgerGroup.onHold) Text(' · ${l10n.ledgerOnHoldNote}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    ]),
                  ]),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(money(figure.amount), style: homeDisplay(17, colors.inkStrong)),
                  if (late > 0)
                    Container(
                      margin: const EdgeInsets.only(top: 3),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
                      decoration: BoxDecoration(color: colors.error.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(99)),
                      child: Text(ledgerStateLabel(l10n, LedgerState.late),
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: colors.error)),
                    ),
                ]),
                if (open) ...[
                  const SizedBox(width: 2),
                  Icon(AppIcons.chevronForward, size: 18, color: AppPalette.gold400),
                ],
              ]),
              if (states.isNotEmpty) ...[
                const SizedBox(height: 14),
                Row(children: [
                  for (final (i, st) in states.indexed) ...[
                    if (i > 0) const SizedBox(width: 3),
                    Expanded(
                      flex: (figure.states[st]!.amount / total * 1000).round().clamp(8, 1000),
                      child: Container(
                        height: 8,
                        decoration: BoxDecoration(color: ledgerStateColor(colors, st), borderRadius: BorderRadius.circular(99)),
                      ),
                    ),
                  ],
                ]),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                  child: Column(children: [
                    for (final st in states)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(children: [
                          Container(width: 9, height: 9, decoration: BoxDecoration(color: ledgerStateColor(colors, st), shape: BoxShape.circle)),
                          const SizedBox(width: 8),
                          Expanded(child: Text(ledgerStateLabel(l10n, st), style: TextStyle(fontSize: 12, color: colors.inkMuted))),
                          Text(money(figure.states[st]!.amount), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                        ]),
                      ),
                  ]),
                ),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}

class _PeriodSheet extends StatefulWidget {
  const _PeriodSheet({required this.selected, required this.enabled, required this.onApply});
  final LedgerPeriod selected;
  final bool enabled;
  final ValueChanged<LedgerPeriod> onApply;

  @override
  State<_PeriodSheet> createState() => _PeriodSheetState();
}

class _PeriodSheetState extends State<_PeriodSheet> {
  late LedgerPeriod _p = widget.selected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return FilterSheet(
      title: l10n.ledgerFilterTitle,
      active: _p == LedgerPeriod.all ? 0 : 1,
      onClear: () => setState(() => _p = LedgerPeriod.all),
      applyLabel: l10n.ledgerFilterApply,
      onApply: () {
        widget.onApply(_p);
        Navigator.of(context).pop();
      },
      sections: [
        FilterSection(
          icon: Icons.date_range_rounded,
          title: l10n.ledgerFilterPeriod,
          child: FilterRadioList<LedgerPeriod>(
            keyPrefix: 'ledger-period',
            selected: _p,
            onSelect: (v) => setState(() => _p = v),
            options: [
              for (final p in LedgerPeriod.values)
                FilterOption(p, ledgerPeriodLabel(l10n, p), empty: !widget.enabled && p != LedgerPeriod.all),
            ],
          ),
        ),
      ],
    );
  }
}
