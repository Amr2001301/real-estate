import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

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
                null => [const KitCardsSkeleton(count: 4)],
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
    final shown = [for (final g in all) if (fig(g).count > 0) g];
    return Column(children: [
      if (shown.isNotEmpty)
        Container(
          decoration: homeCard(context, radius: 22),
          clipBehavior: Clip.antiAlias,
          child: Material(
            color: Colors.transparent,
            child: Column(children: [
              for (final (i, g) in shown.indexed) ...[
                if (i > 0) Divider(height: 1, thickness: 1, indent: 16, endIndent: 16, color: colors.hairline),
                _GroupCard(group: g, figure: fig(g), range: _range),
              ],
            ]),
          ),
        ),
      if (empty.isNotEmpty)
        Padding(
          key: Key('ledger-empty-${receivable ? 'in' : 'out'}'),
          padding: const EdgeInsets.fromLTRB(4, 10, 4, 0),
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
    final (net, netUnit) = homeCompact(s.net.abs(), l10n);
    final symbol = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    DvStat stat(String id, double v, String label) {
      final (n, u) = homeCompact(v, l10n);
      return DvStat(id: id, label: label, value: n, unit: u);
    }

    return [
      const SizedBox(height: 16),
      DvHeroStats(
        id: 'net',
        label: l10n.ledgerNet,
        value: net,
        unit: '$netUnit $symbol'.trim(),
        note: netPositive ? l10n.ledgerNetForCompany : l10n.ledgerNetOnCompany,
        figures: [stat('receivables', s.receivables, l10n.ledgerReceivables), stat('payables', s.payables, l10n.ledgerPayables)],
      ),
      HomeSection(icon: Icons.south_west_rounded, title: l10n.ledgerReceivablesTitle, child: _groups(context, s, receivable: true)),
      HomeSection(icon: Icons.north_east_rounded, title: l10n.ledgerPayablesTitle, child: _groups(context, s, receivable: false)),
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
    final open = figure.count > 0;
    return InkWell(
      key: Key('ledger-group-${group.wire}'),
      onTap: open ? () => context.push('/ledger/${group.wire}', extra: (dateFrom: range.dateFrom, dateTo: range.dateTo)) : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
              child: Icon(ledgerGroupIcon(group), size: 20, color: colors.inkStrong),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(ledgerGroupTitle(l10n, group), style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: colors.inkStrong)),
                const SizedBox(height: 2),
                Text(
                  [l10n.ledgerItems(figure.count), if (group == LedgerGroup.onHold) l10n.ledgerOnHoldNote].join(' · '),
                  style: TextStyle(fontSize: 12, color: colors.inkMuted),
                ),
              ]),
            ),
            Text(money(figure.amount), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            if (open) ...[const SizedBox(width: 2), Icon(AppIcons.chevronForward, size: 18, color: colors.inkMuted)],
          ]),
          if (states.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(children: [
              for (final (i, st) in states.indexed) ...[
                if (i > 0) const SizedBox(width: 2),
                Expanded(
                  flex: (figure.states[st]!.amount / total * 1000).round().clamp(8, 1000),
                  child: Container(height: 8, decoration: BoxDecoration(color: ledgerStateColor(colors, st), borderRadius: BorderRadius.circular(4))),
                ),
              ],
            ]),
            const SizedBox(height: 10),
            Wrap(spacing: 14, runSpacing: 4, children: [
              for (final st in states)
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: ledgerStateColor(colors, st), shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Text('${ledgerStateLabel(l10n, st)} ${money(figure.states[st]!.amount)}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                ]),
            ]),
          ],
        ]),
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
