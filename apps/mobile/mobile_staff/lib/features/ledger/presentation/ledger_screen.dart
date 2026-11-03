import 'package:core/core.dart';
import 'package:flutter/material.dart';
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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final r = _result;
    return Scaffold(
      backgroundColor: colors.canvas,
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.ledgerTitle,
            subtitle: switch (r) {
              Ok(:final data) => '${l10n.ledgerSubtitle} · ${l10n.statementAsOf(DateFormatter.mediumDate(data.asOf, languageCode: lang))}',
              _ => l10n.ledgerSubtitle,
            },
            compact: true,
            leadingAction: const NavHeaderBack(),
          ),
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
              children: [
                for (final p in LedgerPeriod.values) ...[
                  ChoiceChip(
                    key: Key('ledger-period-${p.name}'),
                    label: Text(ledgerPeriodLabel(l10n, p)),
                    selected: _period == p,
                    onSelected: _today == null && p != LedgerPeriod.all
                        ? null
                        : (_) {
                            setState(() => _period = p);
                            _load();
                          },
                  ),
                  const SizedBox(width: AppSpacing.xs),
                ],
              ],
            ),
          ),
          Expanded(
            child: switch (r) {
              null => const Center(child: CircularProgressIndicator()),
              Err(:final failure) => ErrorState(failure: failure, onRetry: _load),
              Ok(:final data) => RefreshIndicator(
                  onRefresh: _load,
                  child: _LedgerBody(summary: data, range: _range),
                ),
            },
          ),
        ],
      ),
    );
  }
}

class _LedgerBody extends StatelessWidget {
  const _LedgerBody({required this.summary, required this.range});
  final LedgerSummary summary;
  final ({String? dateFrom, String? dateTo}) range;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);
    final s = summary;
    final netPositive = s.net >= 0;

    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.xs,
        AppSpacing.lg,
        AppSpacing.xl + MediaQuery.of(context).padding.bottom,
      ),
      children: [
        Container(
          key: const Key('ledger-net'),
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF243F62), Color(0xFF0B1726)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadii.xl),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.ledgerNet,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: AlignmentDirectional.centerStart,
                child: Text(
                  money(s.net.abs()),
                  style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900, height: 1.1),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                netPositive ? l10n.ledgerNetForCompany : l10n.ledgerNetOnCompany,
                style: TextStyle(
                  color: netPositive ? const Color(0xFF4ADE80) : const Color(0xFFF87171),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          children: [
            Expanded(
              child: AppKpiTile(
                key: const Key('ledger-receivables'),
                icon: Icons.south_west_rounded,
                iconColor: colors.success,
                label: l10n.ledgerReceivables,
                value: money(s.receivables),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: AppKpiTile(
                key: const Key('ledger-payables'),
                icon: Icons.north_east_rounded,
                iconColor: colors.error,
                label: l10n.ledgerPayables,
                value: money(s.payables),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        AppSectionHeader(title: l10n.ledgerReceivablesTitle),
        const SizedBox(height: AppSpacing.sm),
        for (final g in LedgerGroup.values.where((g) => g.receivable))
          _GroupCard(group: g, figure: s.groups[g] ?? const LedgerFigure(amount: 0, count: 0), range: range),
        const SizedBox(height: AppSpacing.md),
        AppSectionHeader(title: l10n.ledgerPayablesTitle),
        const SizedBox(height: AppSpacing.sm),
        for (final g in LedgerGroup.values.where((g) => !g.receivable))
          _GroupCard(group: g, figure: s.groups[g] ?? const LedgerFigure(amount: 0, count: 0), range: range),
      ],
    );
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
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);
    final states = LedgerState.values.where((s) => (figure.states[s]?.amount ?? 0) > 0).toList();
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: AppCard(
        key: Key('ledger-group-${group.wire}'),
        onTap: figure.count == 0
            ? null
            : () => context.push(
                  '/ledger/${group.wire}',
                  extra: (dateFrom: range.dateFrom, dateTo: range.dateTo),
                ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    ledgerGroupTitle(l10n, group),
                    style: theme.textTheme.titleSmall?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w800),
                  ),
                ),
                Text(
                  money(figure.amount),
                  style: theme.textTheme.titleSmall?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Text(l10n.ledgerItems(figure.count), style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
                if (group == LedgerGroup.onHold) ...[
                  const SizedBox(width: 6),
                  Text('· ${l10n.ledgerOnHoldNote}', style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
                ],
              ],
            ),
            if (states.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final st in states)
                    AppInfoChip(
                      icon: Icons.circle,
                      label: '${ledgerStateLabel(l10n, st)} ${money(figure.states[st]!.amount)}',
                      color: ledgerStateColor(colors, st),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
