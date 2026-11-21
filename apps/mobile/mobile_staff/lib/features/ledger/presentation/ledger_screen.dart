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

  List<Widget> _body(BuildContext context, LedgerSummary s) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final netPositive = s.net >= 0;
    final symbol = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    // What is owed to the company, by state, across its groups.
    final byState = <LedgerState, double>{};
    for (final g in LedgerGroup.values.where((g) => g.receivable)) {
      final f = s.groups[g];
      if (f == null) continue;
      f.states.forEach((st, v) => byState[st] = (byState[st] ?? 0) + v.amount);
    }
    final states = LedgerState.values.where((st) => (byState[st] ?? 0) > 0).toList();
    final (rec, recUnit) = homeCompact(s.receivables, l10n);
    final (net, netUnit) = homeCompact(s.net.abs(), l10n);
    final (pay, payUnit) = homeCompact(s.payables, l10n);

    final groups = LedgerGroup.values.where((g) => (s.groups[g]?.count ?? 0) > 0).toList();
    final empty = [for (final g in LedgerGroup.values) if ((s.groups[g]?.count ?? 0) == 0) ledgerGroupTitle(l10n, g)];
    return [
      Container(
        margin: const EdgeInsets.fromLTRB(AppSpacing.md, 16, AppSpacing.md, 0),
        padding: const EdgeInsets.all(18),
        decoration: homeCard(context, radius: 22),
        child: Column(children: [
          Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            DvDonut(
              parts: [for (final st in states) (byState[st]!, ledgerStateColor(colors, st))],
              center: Column(mainAxisSize: MainAxisSize.min, children: [
                Text(ltr(rec), key: const Key('dv-stat-receivables'), style: TextStyle(fontSize: 19, height: 1.1, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                Text(recUnit.trim().isEmpty ? l10n.ledgerReceivables : recUnit, style: TextStyle(fontSize: 11, color: colors.inkMuted)),
              ]),
            ),
            const SizedBox(width: 18),
            Expanded(
              child: Column(children: [
                for (final st in states)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(children: [
                      Container(width: 10, height: 10, decoration: BoxDecoration(color: ledgerStateColor(colors, st), shape: BoxShape.circle)),
                      const SizedBox(width: 8),
                      Expanded(child: Text(ledgerStateLabel(l10n, st), style: TextStyle(fontSize: 12.5, color: colors.inkMuted))),
                      Text(ltr(homeCompactText(byState[st]!, l10n)), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                    ]),
                  ),
              ]),
            ),
          ]),
          Padding(padding: const EdgeInsets.symmetric(vertical: 14), child: Divider(height: 1, color: colors.hairline)),
          Row(key: const Key('dv-stat-payables'), children: [
            Expanded(child: Text(l10n.ledgerPayables, style: TextStyle(fontSize: 13, color: colors.inkMuted))),
            Text('${ltr(pay)} $payUnit'.trim(), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: s.payables > 0 ? colors.error : colors.inkStrong)),
          ]),
          const SizedBox(height: 8),
          Row(key: const Key('dv-stat-net'), children: [
            Expanded(child: Text('${l10n.ledgerNet} · ${netPositive ? l10n.ledgerNetForCompany : l10n.ledgerNetOnCompany}', style: TextStyle(fontSize: 13, color: colors.inkMuted))),
            Text('${ltr(net)} $netUnit $symbol'.trim(), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: colors.inkStrong)),
          ]),
        ]),
      ),
      HomeSection(
        icon: Icons.list_rounded,
        title: l10n.ledgerTitle,
        child: Column(children: [
          if (groups.isNotEmpty)
            Container(
              decoration: homeCard(context, radius: 22),
              clipBehavior: Clip.antiAlias,
              child: Material(
                color: Colors.transparent,
                child: Column(children: [
                  for (final (i, g) in groups.indexed) ...[
                    if (i > 0) Divider(height: 1, thickness: 1, indent: 16, endIndent: 16, color: colors.hairline),
                    _GroupCard(group: g, figure: s.groups[g]!, range: _range),
                  ],
                ]),
              ),
            ),
          if (empty.isNotEmpty)
            Padding(
              key: const Key('ledger-empty-in'),
              padding: const EdgeInsets.fromLTRB(4, 10, 4, 0),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(Icons.check_circle_outline_rounded, size: 16, color: colors.inkMuted),
                const SizedBox(width: 6),
                Expanded(child: Text(l10n.ledgerNoItemsIn(empty.join(' · ')), style: TextStyle(fontSize: 12, height: 1.5, color: colors.inkMuted))),
              ]),
            ),
        ]),
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
    final late = figure.states[LedgerState.late]?.amount ?? 0;
    final open = figure.count > 0;
    return InkWell(
      key: Key('ledger-group-${group.wire}'),
      onTap: open ? () => context.push('/ledger/${group.wire}', extra: (dateFrom: range.dateFrom, dateTo: range.dateTo)) : null,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 15, 16, 15),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(ledgerGroupTitle(l10n, group), style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: colors.inkStrong)),
              const SizedBox(height: 3),
              Text(
                [
                  if (!group.receivable) l10n.ledgerPayables,
                  l10n.ledgerItems(figure.count),
                  if (late > 0) '${ledgerStateLabel(l10n, LedgerState.late)} ${money(late)}',
                  if (group == LedgerGroup.onHold) l10n.ledgerOnHoldNote,
                ].join(' · '),
                style: TextStyle(fontSize: 12, height: 1.4, color: late > 0 ? colors.error : colors.inkMuted),
              ),
            ]),
          ),
          const SizedBox(width: 10),
          Text(money(figure.amount), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: colors.inkStrong)),
          if (open) ...[const SizedBox(width: 2), Icon(AppIcons.chevronForward, size: 18, color: colors.inkMuted)],
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
