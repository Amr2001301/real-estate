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
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            decoration: homeCard(context, radius: 22),
                            child: IntrinsicHeight(
                              child: Row(children: [
                                _Stat('${p.leadsCount}', l10n.dashboardLeads),
                                VerticalDivider(width: 1, color: colors.hairline),
                                _Stat('${p.visitsCount}', l10n.navVisits),
                                VerticalDivider(width: 1, color: colors.hairline),
                                _Stat('${p.reservationsCount}', l10n.navReservations),
                                VerticalDivider(width: 1, color: colors.hairline),
                                _Stat('${p.signedContractsCount}', l10n.targetsSignedContracts),
                              ]),
                            ),
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
    final unitsLeft = (p.targetUnits ?? 0) - p.achievedUnits;
    Widget block(Key? key, String title, String of, double? pct, Color color, String? remaining, Key pctKey) {
      final v = (pct ?? 0).clamp(0, 100).toDouble();
      return Padding(
        key: key,
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(child: Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.inkStrong))),
            Text(of, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
          ]),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: LinearProgressIndicator(value: v / 100, minHeight: 10, color: color, backgroundColor: colors.surfaceSoft),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Text(ltr('${v.round()}%'), key: pctKey, style: TextStyle(fontSize: 20, height: 1.2, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            const Spacer(),
            if (remaining != null) Text('${l10n.tgRemaining} $remaining', style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
          ]),
        ]),
      );
    }

    return Container(
      key: const Key('targets-progress'),
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      decoration: homeCard(context, radius: 22),
      child: Column(children: [
        block(
          const Key('dv-stat-sales'),
          l10n.tgSales,
          '${contractMoney(p.achievedAmount)} ${l10n.tgOf('${contractMoney(p.targetAmount ?? 0)} $currency')}',
          p.targetAmountPercent,
          AppPalette.gold500,
          left > 0 ? contractMoney(left) : null,
          const Key('dv-stat-pct'),
        ),
        Divider(height: 1, color: colors.hairline),
        block(
          const Key('dv-stat-units'),
          l10n.tgUnitsSold,
          l10n.tgUnitsOf(p.achievedUnits, p.targetUnits ?? 0),
          p.targetUnitsPercent,
          const Color(0xFF1B2A48),
          unitsLeft > 0 ? l10n.targetsUnitsN(unitsLeft) : null,
          const Key('dv-stat-units-pct'),
        ),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.value, this.label);
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Expanded(
      child: Column(children: [
        Text(ltr(value), style: TextStyle(fontSize: 21, height: 1.2, fontWeight: FontWeight.w700, color: colors.inkStrong)),
        const SizedBox(height: 3),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Text(label, maxLines: 2, textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, height: 1.3, color: colors.inkMuted)),
        ),
      ]),
    );
  }
}
