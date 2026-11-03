import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return Scaffold(
      backgroundColor: colors.canvas,
      body: Column(
        children: [
          AppNavHeader(
            title: ledgerGroupTitle(l10n, widget.group),
            subtitle: l10n.ledgerTitle,
            compact: true,
            leadingAction: const NavHeaderBack(),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 0),
            child: AppFilterPills<LedgerState>(
              options: [
                for (final s in LedgerState.values) FilterPillOption(value: s, label: ledgerStateLabel(l10n, s)),
              ],
              selected: _state,
              allLabel: l10n.leadsFilterAll,
              onSelected: (s) {
                _state = s;
                _reload();
              },
            ),
          ),
          Expanded(
            child: _failure != null && _rows.isEmpty
                ? ErrorState(failure: _failure, onRetry: _reload)
                : _rows.isEmpty && !_loading
                    ? EmptyState(icon: Icons.inbox_outlined, title: l10n.ledgerEmpty)
                    : RefreshIndicator(
                        onRefresh: _reload,
                        child: ListView.separated(
                          controller: _scroll,
                          padding: EdgeInsets.fromLTRB(
                            AppSpacing.lg,
                            AppSpacing.md,
                            AppSpacing.lg,
                            AppSpacing.xl + MediaQuery.of(context).padding.bottom,
                          ),
                          itemCount: _rows.length + (_loading ? 1 : 0),
                          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                          itemBuilder: (_, i) => i >= _rows.length
                              ? const Padding(
                                  padding: EdgeInsets.all(AppSpacing.md),
                                  child: Center(child: CircularProgressIndicator()),
                                )
                              : _RowCard(row: _rows[i]),
                        ),
                      ),
          ),
        ],
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
    final where = [
      if (ref != null) ltr(ref),
      if (row.unitCode != null) ltr(row.unitCode!),
    ].join(' · ');
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline),
      ),
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
                if (where.isNotEmpty)
                  Text(
                    where,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    softWrap: false,
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                PriceFormatter.format(row.amount, languageCode: lang),
                style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w800),
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
