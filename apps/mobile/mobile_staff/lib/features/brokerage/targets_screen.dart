import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../common/staff_list_skeleton.dart';
import 'brokerage_data.dart';
import '../leads/presentation/follow_up_labels.dart' show latinDigits;
import 'brokerage_kit.dart';

/// «هدفي» / «أهداف الفريق» — the month's targets: the company commission the
/// person's deals brought in against the target, the deals against theirs,
/// and the bonus. A rep sees their own; a manager the team; the admin all.
class BxTargetsScreen extends StatefulWidget {
  const BxTargetsScreen({super.key, required this.repository, required this.mine, required this.userId});
  final BrokerageRepository repository;

  /// A rep's own target (the title says «هدفي»).
  final bool mine;

  /// The caller, whose row comes first.
  final String userId;

  @override
  State<BxTargetsScreen> createState() => _BxTargetsScreenState();
}

class _BxTargetsScreenState extends State<BxTargetsScreen> {
  late String _period = bxPeriod(DateTime.now());
  BxTargets? _data;
  AppFailure? _failure;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failure = null;
    });
    final period = _period;
    final r = await widget.repository.targets(period: period);
    if (!mounted || period != _period) return;
    setState(() {
      _loading = false;
      switch (r) {
        case Ok(data: final v):
          _data = v;
        case Err(failure: final f):
          _failure = f;
      }
    });
  }

  void _shift(int months) {
    final parts = _period.split('-').map(int.parse).toList();
    final next = DateTime(parts[0], parts[1] + months);
    if (next.isAfter(DateTime.now())) return;
    setState(() => _period = bxPeriod(next));
    _load();
  }

  String _monthLabel(BuildContext context) {
    final parts = _period.split('-').map(int.parse).toList();
    final lang = Localizations.localeOf(context).languageCode;
    return latinDigits(DateFormatter.monthYear(DateTime(parts[0], parts[1]), languageCode: lang));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final data = _data;
    final isCurrent = _period == bxPeriod(DateTime.now());
    final rows = [...?data?.rows]..sort((a, b) => a.userId == widget.userId ? -1 : (b.userId == widget.userId ? 1 : b.commission.compareTo(a.commission)));
    final me = rows.where((r) => r.userId == widget.userId).firstOrNull;
    final others = widget.mine ? const <BxTargetRow>[] : rows.where((r) => r.userId != widget.userId).toList();
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('bx-targets'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24),
            children: [
              HomeListHero(
                back: true,
                title: widget.mine ? l10n.bxTargetMine : l10n.bxTargetTeam,
                subtitle: !widget.mine && data != null && !_loading ? l10n.bxAchievedN(data.achieved, data.withTarget) : null,
                bottom: Row(children: [
                  HomeHeroButton(icon: Icons.chevron_left_rounded, tooltip: l10n.bxPrevMonth, onTap: () => _shift(-1)),
                  Expanded(child: Text(_monthLabel(context), textAlign: TextAlign.center, style: homeDisplay(17, Colors.white))),
                  Opacity(
                    opacity: isCurrent ? 0.35 : 1,
                    child: HomeHeroButton(icon: Icons.chevron_right_rounded, tooltip: l10n.bxNextMonth, onTap: () => _shift(1)),
                  ),
                ]),
              ),
              if (_loading && data == null)
                const SizedBox(height: 480, child: StaffListSkeleton(rows: 4))
              else if (_failure != null && data == null)
                ErrorState(failure: _failure, onRetry: _load)
              else if (data != null) ...[
                if (me != null)
                  Padding(padding: const EdgeInsets.only(top: 16), child: BxTargetGoal(row: me))
                else if (widget.mine)
                  Padding(padding: const EdgeInsets.only(top: 16), child: BxTargetGoal(row: null)),
                if (me != null && me.hasTarget) Padding(padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0), child: _DetailCard(row: me)),
                if (others.isNotEmpty)
                  HomeSection(
                    icon: Icons.groups_rounded,
                    title: l10n.bxTargetTeam,
                    child: Column(children: [
                      for (final r in others) ...[_TeamRow(row: r), const SizedBox(height: 8)],
                    ]),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The ring card: the commission the person's deals brought in this month
/// against the target, and the deals against theirs.
class BxTargetGoal extends StatelessWidget {
  const BxTargetGoal({super.key, required this.row, this.title});
  final BxTargetRow? row;

  /// The card's line over the figure; the person's own commission by default.
  final String? title;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final r = row;
    final (v, unit) = homeCompact(r?.commission ?? 0, l10n);
    return HomeGoalCard(
      percent: r != null && r.hasTarget ? (r.commissionPct ?? 0) : null,
      percentLabel: l10n.shOfGoal,
      icon: Icons.flag_rounded,
      title: title ?? l10n.bxHomeGoalTitle,
      value: v,
      unit: unit,
      trailing: r != null && r.hasTarget ? l10n.bxOfTarget('${homeCompactText(r.commissionTarget!, l10n)} ${bxCurrency(context)}') : '',
      minis: r == null
          ? const []
          : [
              (l10n.bxDealsGoal, ltr('${r.deals} / ${r.dealsTarget ?? 0}')),
              (l10n.bxBonus, r.bonusAmount != null && r.bonusAmount! > 0 ? '${bxMoney(r.bonusAmount!)} ${bxCurrency(context)}' : '—'),
            ],
      emptyText: l10n.bxNoTarget,
    );
  }
}

/// The two goals as bars, and the bonus state.
class _DetailCard extends StatelessWidget {
  const _DetailCard({required this.row});
  final BxTargetRow row;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final r = row;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: homeCard(context, radius: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _Goal(label: l10n.bxCommission, pct: r.commissionPct ?? 0, value: '${bxMoney(r.commission)} / ${bxMoney(r.commissionTarget ?? 0)} ${bxCurrency(context)}'),
        const SizedBox(height: 12),
        _Goal(label: l10n.bxDealsGoal, pct: r.dealsPct ?? 0, value: ltr('${r.deals} / ${r.dealsTarget ?? 0}')),
        const SizedBox(height: 12),
        Row(children: [
          Icon(Icons.card_giftcard_rounded, size: 18, color: AppPalette.gold500),
          const SizedBox(width: 6),
          Text(l10n.bxBonus, style: TextStyle(fontSize: 13, color: colors.inkMuted)),
          const Spacer(),
          CatalogBadge.status(bxBonus(l10n, r.bonus), bxBonusColor(r.bonus, colors)),
        ]),
      ]),
    );
  }
}

class _Goal extends StatelessWidget {
  const _Goal({required this.label, required this.pct, required this.value});
  final String label;
  final int pct;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
        const Spacer(),
        Text(ltr('$pct%'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: pct >= 100 ? colors.success : AppPalette.gold600)),
      ]),
      const SizedBox(height: 6),
      BxProgress(value: pct / 100, height: 8),
      const SizedBox(height: 4),
      Text(value, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
    ]);
  }
}

/// A teammate's month: their commission against the target, deals, bonus.
class _TeamRow extends StatelessWidget {
  const _TeamRow({required this.row});
  final BxTargetRow row;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final r = row;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: homeCard(context, radius: 18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          BxIconTile(r.achieved ? Icons.emoji_events_rounded : Icons.person_rounded, r.achieved ? colors.success : homeIsDark(context) ? AppPalette.gold400 : AppPalette.navy, size: 38),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(r.userName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
              Text(
                r.hasTarget ? '${l10n.bxDealsGoal} ${ltr('${r.deals} / ${r.dealsTarget}')}' : l10n.bxNoTarget,
                style: TextStyle(fontSize: 12, color: colors.inkMuted),
              ),
            ]),
          ),
          BxAmount(r.commission, size: 15),
        ]),
        if (r.hasTarget) ...[
          const SizedBox(height: 10),
          BxProgress(value: (r.commissionPct ?? 0) / 100),
          const SizedBox(height: 6),
          Row(children: [
            Text(l10n.bxOfTarget('${bxMoney(r.commissionTarget!)} ${bxCurrency(context)}'), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
            const Spacer(),
            CatalogBadge.status(bxBonus(l10n, r.bonus), bxBonusColor(r.bonus, colors)),
          ]),
        ],
      ]),
    );
  }
}
