import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../domain/entities/sales_performance.dart';
import '../cubit/targets_cubit.dart';
import '../period.dart';

/// «أهدافي» (design t1, owner-approved 2026-11-05): this period's progress on
/// the sales value and the units, what is left, the rep's activity, and the
/// history of targets.
class TargetsScreen extends StatefulWidget {
  const TargetsScreen({super.key});

  @override
  State<TargetsScreen> createState() => _TargetsScreenState();
}

class _TargetsScreenState extends State<TargetsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<TargetsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final cubit = context.read<TargetsCubit>();
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<TargetsCubit, TargetsState>(
          builder: (context, state) {
            final p = state.performance;
            return Column(children: [
              HomeListHero(title: l10n.targetsTitle, subtitle: p == null ? null : periodLabel(p.period, lang), back: true),
              Expanded(
                child: switch (state.status) {
                  DataStatus.initial || DataStatus.loading => const StaffListSkeleton(rows: 4),
                  DataStatus.failure => ErrorState(failure: state.failure, onRetry: cubit.load),
                  _ when p == null => const SizedBox.shrink(),
                  _ => RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24), children: [
                        const SizedBox(height: 16),
                        _Progress(perf: p, currency: currency),
                        HomeSection(
                          icon: Icons.insights_rounded,
                          title: l10n.tgPeriodActivity,
                          child: GridView.count(
                            padding: EdgeInsets.zero,
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisCount: 2,
                            mainAxisSpacing: 10,
                            crossAxisSpacing: 10,
                            childAspectRatio: 2.5,
                            children: [
                              _Stat(Icons.person_outline_rounded, '${p.leadsCount}', l10n.dashboardLeads),
                              _Stat(Icons.event_rounded, '${p.visitsCount}', l10n.navVisits),
                              _Stat(Icons.bookmark_outline_rounded, '${p.reservationsCount}', l10n.navReservations),
                              _Stat(Icons.description_outlined, '${p.signedContractsCount}', l10n.targetsSignedContracts),
                            ],
                          ),
                        ),
                        if (state.targets.isNotEmpty)
                          HomeSection(
                            icon: Icons.history_rounded,
                            title: l10n.targetsHistory,
                            child: Container(
                              decoration: homeCard(context, radius: 22),
                              child: Column(children: [
                                for (final (i, t) in state.targets.indexed) ...[
                                  if (i > 0) Divider(height: 1, thickness: 1, indent: 16, endIndent: 16, color: colors.hairline),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                    child: Row(children: [
                                      Container(
                                        width: 40,
                                        height: 40,
                                        decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                                        child: Icon(Icons.track_changes_rounded, size: 20, color: colors.inkStrong),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                          Text(periodLabel(t.period, lang), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.inkStrong)),
                                          const SizedBox(height: 2),
                                          Text(l10n.targetsUnitsN(t.unitsTarget), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                                        ]),
                                      ),
                                      Text('${contractMoney(double.tryParse(t.amountTarget) ?? 0)} $currency', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                                    ]),
                                  ),
                                ],
                              ]),
                            ),
                          ),
                      ]),
                    ),
                },
              ),
            ]);
          },
        ),
      ),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.perf, required this.currency});
  final SalesPerformance perf;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final p = perf;
    if (!p.hasTarget) {
      return Container(
        key: const Key('targets-progress'),
        margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        padding: const EdgeInsets.all(16),
        decoration: homeCard(context, radius: 22),
        child: Row(children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
            child: Icon(Icons.flag_outlined, size: 20, color: colors.inkStrong),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(l10n.tgNoTarget, style: TextStyle(fontSize: 13.5, height: 1.5, color: colors.ink))),
        ]),
      );
    }
    final left = (p.targetAmount ?? 0) - p.achievedAmount;
    final pct = (p.targetAmountPercent ?? 0).clamp(0, 100).toDouble();
    Widget row(String k, String v) => Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(children: [
            Expanded(child: Text(k, style: TextStyle(fontSize: 12.5, color: colors.inkMuted))),
            Text(v, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
          ]),
        );
    return Container(
      key: const Key('targets-progress'),
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      padding: const EdgeInsets.all(18),
      decoration: homeCard(context, radius: 22),
      child: Row(children: [
        SizedBox(
          width: 104,
          height: 104,
          child: Stack(alignment: Alignment.center, children: [
            SizedBox(
              width: 104,
              height: 104,
              child: CircularProgressIndicator(value: pct / 100, strokeWidth: 11, strokeCap: StrokeCap.round, color: AppPalette.gold500, backgroundColor: colors.surfaceSoft),
            ),
            Column(mainAxisSize: MainAxisSize.min, children: [
              Text(ltr('${pct.round()}%'), key: const Key('dv-stat-pct'), style: TextStyle(fontSize: 24, height: 1.1, fontWeight: FontWeight.w700, color: colors.inkStrong)),
              Text(l10n.tgAchievement, style: TextStyle(fontSize: 11, color: colors.inkMuted)),
            ]),
          ]),
        ),
        const SizedBox(width: 18),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(l10n.tgSales, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
            const SizedBox(height: 2),
            Text(contractMoney(p.achievedAmount), key: const Key('dv-stat-sales'), style: TextStyle(fontSize: 26, height: 1.2, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            Text(l10n.tgOf('${contractMoney(p.targetAmount ?? 0)} $currency'), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
            Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Divider(height: 1, color: colors.hairline)),
            row(l10n.tgUnitsSold, l10n.tgUnitsOf(p.achievedUnits, p.targetUnits ?? 0)),
            if (left > 0) row(l10n.tgRemaining, contractMoney(left)),
          ]),
        ),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.icon, this.value, this.label);
  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: homeCard(context, radius: 18),
      child: Row(children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, size: 19, color: colors.inkStrong),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(ltr(value), style: TextStyle(fontSize: 20, height: 1.1, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            const SizedBox(height: 2),
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          ]),
        ),
      ]),
    );
  }
}
