import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../dashboard/home_kit/filter_kit.dart';
import '../../dashboard/home_kit/home_kit.dart';
import '../domain/ledger.dart';
import 'ledger_labels.dart';

/// One group of «ليا وعليا», row by row, oldest first — filter by state.
class LedgerGroupScreen extends StatefulWidget {
  const LedgerGroupScreen({super.key, required this.group, this.dateFrom, this.dateTo});
  final LedgerGroup group;
  final String? dateFrom;
  final String? dateTo;

  @override
  State<LedgerGroupScreen> createState() => _LedgerGroupScreenState();
}

class _LedgerGroupScreenState extends State<LedgerGroupScreen> {
  final _scroll = ScrollController();
  final _rows = <LedgerRow>[];
  LedgerState? _state;
  AppFailure? _failure;
  bool _loading = false;
  bool _hasMore = true;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) _more();
    });
    _reload();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() {
      _rows.clear();
      _page = 0;
      _hasMore = true;
      _failure = null;
    });
    await _more();
  }

  Future<void> _more() async {
    if (_loading || !_hasMore) return;
    setState(() => _loading = true);
    final res = await context.read<LedgerRepository>().rows(
          widget.group,
          state: _state,
          dateFrom: widget.dateFrom,
          dateTo: widget.dateTo,
          page: _page + 1,
        );
    if (!mounted) return;
    setState(() {
      _loading = false;
      switch (res) {
        case Ok(:final data):
          _page += 1;
          _rows.addAll(data.data);
          _hasMore = data.hasMore;
        case Err(:final failure):
          _failure = failure;
          _hasMore = false;
      }
    });
  }

  void _filters() {
    showFilterSheet(
      context,
      (_) => _StateSheet(
        selected: _state,
        onApply: (v) {
          _state = v;
          _reload();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: RefreshIndicator(
          onRefresh: _reload,
          child: CustomScrollView(
            key: const Key('ledger-group'),
            controller: _scroll,
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: HomeListHero(
                  back: true,
                  title: ledgerGroupTitle(l10n, widget.group),
                  subtitle: _state == null ? l10n.ledgerTitle : '${l10n.ledgerTitle} · ${ledgerStateLabel(l10n, _state!)}',
                  actions: [
                    HomeHeroButton(
                      key: const Key('ledger-filters'),
                      icon: Icons.tune_rounded,
                      dot: _state != null,
                      tooltip: l10n.ledgerFilterTitle,
                      onTap: _filters,
                    ),
                  ],
                ),
              ),
              if (_failure != null && _rows.isEmpty)
                SliverToBoxAdapter(child: ErrorState(failure: _failure, onRetry: _reload))
              else if (_rows.isEmpty && !_loading)
                SliverToBoxAdapter(child: EmptyState(icon: Icons.inbox_outlined, title: l10n.ledgerEmpty))
              else
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, MediaQuery.paddingOf(context).bottom + 32),
                  sliver: SliverList.separated(
                    itemCount: _rows.length + (_loading ? 1 : 0),
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => i >= _rows.length
                        ? const Padding(padding: EdgeInsets.all(AppSpacing.md), child: Center(child: CircularProgressIndicator()))
                        : _RowCard(row: _rows[i]),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RowCard extends StatelessWidget {
  const _RowCard({required this.row});
  final LedgerRow row;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final ref = row.contractNumber ?? row.reservationNumber;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: homeCard(context, radius: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.partyName ?? ledgerTypeLabel(l10n, row.type),
                  style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    ledgerTypeLabel(l10n, row.type),
                    if (row.date != null) DateFormatter.mediumDate(row.date!, languageCode: lang),
                  ].join(' · '),
                  style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                ),
                if (ref != null || row.unitCode != null) ...[
                  const SizedBox(height: 7),
                  Wrap(spacing: 6, runSpacing: 4, children: [
                    if (ref != null) _Ref(text: ref, gold: true),
                    if (row.unitCode != null) _Ref(text: row.unitCode!),
                  ]),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                PriceFormatter.format(row.amount, languageCode: lang),
                style: homeDisplay(15, colors.inkStrong),
              ),
              if (row.state != null) ...[
                const SizedBox(height: 4),
                StatusBadge(
                  label: ledgerStateLabel(l10n, row.state!),
                  tone: switch (row.state!) {
                    LedgerState.late => BadgeTone.error,
                    LedgerState.dueToday => BadgeTone.warning,
                    LedgerState.onItsWay => BadgeTone.gold,
                    _ => BadgeTone.neutral,
                  },
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _StateSheet extends StatefulWidget {
  const _StateSheet({required this.selected, required this.onApply});
  final LedgerState? selected;
  final ValueChanged<LedgerState?> onApply;

  @override
  State<_StateSheet> createState() => _StateSheetState();
}

class _StateSheetState extends State<_StateSheet> {
  late LedgerState? _s = widget.selected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return FilterSheet(
      title: l10n.ledgerFilterTitle,
      active: _s == null ? 0 : 1,
      onClear: () => setState(() => _s = null),
      applyLabel: l10n.ledgerFilterApply,
      onApply: () {
        widget.onApply(_s);
        Navigator.of(context).pop();
      },
      sections: [
        FilterSection(
          icon: Icons.flag_outlined,
          title: l10n.kcStatus,
          child: FilterRadioList<LedgerState?>(
            keyPrefix: 'ledger-state',
            selected: _s,
            onSelect: (v) => setState(() => _s = v),
            options: [
              FilterOption<LedgerState?>(null, l10n.leadsFilterAll),
              for (final st in LedgerState.values) FilterOption<LedgerState?>(st, ledgerStateLabel(l10n, st), color: ledgerStateColor(colors, st)),
            ],
          ),
        ),
      ],
    );
  }
}

/// A contract or unit code as a small tag, kept left to right.
class _Ref extends StatelessWidget {
  const _Ref({required this.text, this.gold = false});
  final String text;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: gold ? AppPalette.gold50 : colors.surfaceSoft,
        border: Border.all(color: gold ? AppPalette.gold100 : colors.hairline),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(ltr(text), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: gold ? AppPalette.gold600 : colors.inkMuted)),
    );
  }
}
