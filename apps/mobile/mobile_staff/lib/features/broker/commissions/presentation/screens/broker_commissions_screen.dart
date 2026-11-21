import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/staff_list_skeleton.dart';
import '../../../../brokerage/brokerage_kit.dart' show BxPill, BxTileCard;
import '../../../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../domain/entities/broker_commission.dart';
import '../../view/broker_payouts_data.dart';
import '../../../profile/presentation/cubit/broker_profile_cubit.dart';
import '../cubit/broker_commissions_cubit.dart';

/// «عمولاتي» for the broker (the same look as the rep's dues, owner-approved
/// 2026-11-05): the net commissions, what waits and what was paid out; the
/// payout statements; the commissions by status, a card each.
class BrokerCommissionsScreen extends StatefulWidget {
  const BrokerCommissionsScreen({super.key});

  @override
  State<BrokerCommissionsScreen> createState() => _BrokerCommissionsScreenState();
}

class _BrokerCommissionsScreenState extends State<BrokerCommissionsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerCommissionsCubit>().load();
    context.read<BrokerPayoutsCubit>().load();
  }

  Future<void> _refresh() async {
    await Future.wait([context.read<BrokerCommissionsCubit>().load(), context.read<BrokerPayoutsCubit>().load()]);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerCommissionsCubit>();
    final currency = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<BrokerCommissionsCubit, BrokerCommissionsState>(
          builder: (context, state) {
            final all = state.allCommissions;
            final ready = state.status == DataStatus.success || state.status == DataStatus.empty;
            final counts = state.statusCounts;
            final net = state.approvedTotal + state.pendingTotal;
            final netF = homeCompact(net, l10n);
            final pend = homeCompact(state.pendingTotal, l10n);
            return BlocBuilder<BrokerPayoutsCubit, List<BrokerPayout>>(
              builder: (context, payouts) {
                final paid = homeCompact(context.read<BrokerPayoutsCubit>().paidTotal, l10n);
                String unit(String u) => [if (u.isNotEmpty) u, currency].join(' ');
                return RefreshIndicator(
                  onRefresh: _refresh,
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      SliverToBoxAdapter(child: HomeListHero(title: l10n.navCommissions, subtitle: l10n.bkSubtitle, back: true)),
                      if (ready && all.isNotEmpty) ...[
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                            child: DvHeroStats(
                              id: 'net',
                              label: l10n.bkNet,
                              value: netF.$1,
                              unit: unit(netF.$2),
                              figures: [
                                DvStat(id: 'pending', label: l10n.bonusStatusPending, value: pend.$1, unit: pend.$2, warn: state.pendingTotal > 0),
                                DvStat(id: 'paid', label: l10n.bkPayouts, value: paid.$1, unit: paid.$2),
                              ],
                            ),
                          ),
                        ),
                        if (payouts.isNotEmpty)
                          SliverToBoxAdapter(
                            child: HomeSection(
                              icon: Icons.account_balance_rounded,
                              title: l10n.bkPayouts,
                              child: Column(children: [for (final p in payouts) Padding(padding: const EdgeInsets.only(bottom: 8), child: _PayoutCard(payout: p))]),
                            ),
                          ),
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.only(top: 18),
                            child: HomePills(pills: [
                              HomePill(id: 'all', label: l10n.leadsFilterAll, count: state.totalCount, selected: state.statusFilter == null, onTap: () => cubit.setStatus(null)),
                              HomePill(id: 'PENDING', label: l10n.bonusStatusPending, count: counts['PENDING'] ?? 0, dot: catalogReserved, selected: state.statusFilter == 'PENDING', onTap: () => cubit.setStatus('PENDING')),
                              HomePill(id: 'APPROVED', label: l10n.bonusStatusApproved, count: counts['APPROVED'] ?? 0, dot: catalogAvailable, selected: state.statusFilter == 'APPROVED', onTap: () => cubit.setStatus('APPROVED')),
                              if ((counts['REJECTED'] ?? 0) > 0) HomePill(id: 'REJECTED', label: l10n.bkStRejected, count: counts['REJECTED'] ?? 0, dot: const Color(0xFFB3261E), selected: state.statusFilter == 'REJECTED', onTap: () => cubit.setStatus('REJECTED')),
                              if ((counts['CANCELLED'] ?? 0) > 0) HomePill(id: 'CANCELLED', label: l10n.bkStCancelled, count: counts['CANCELLED'] ?? 0, dot: const Color(0xFF9A9083), selected: state.statusFilter == 'CANCELLED', onTap: () => cubit.setStatus('CANCELLED')),
                            ]),
                          ),
                        ),
                      ],
                      ...switch (state.status) {
                        DataStatus.initial || DataStatus.loading when all.isEmpty => [const SliverToBoxAdapter(child: SizedBox(height: 500, child: StaffListSkeleton()))],
                        DataStatus.failure when all.isEmpty => [SliverToBoxAdapter(child: (context.read<BrokerProfileCubit>().state.data?.canViewCommissions == false ? EmptyState(icon: Icons.lock_outline_rounded, title: l10n.bkNoCommissionAccess) : ErrorState(failure: state.failure, onRetry: cubit.load)))],
                        DataStatus.empty when all.isEmpty => [SliverToBoxAdapter(child: EmptyState(icon: Icons.payments_rounded, title: l10n.brokerCommissionsEmptyTitle, message: l10n.brokerCommissionsEmptyMessage))],
                        _ when state.commissions.isEmpty => [SliverToBoxAdapter(child: EmptyState(icon: Icons.filter_list_off_rounded, title: l10n.pmNoMatch))],
                        _ => [
                            SliverPadding(
                              padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                              sliver: SliverList.separated(
                                itemCount: state.commissions.length,
                                separatorBuilder: (_, _) => const SizedBox(height: 10),
                                itemBuilder: (context, i) => CommissionCard(commission: state.commissions[i]),
                              ),
                            ),
                          ],
                      },
                      SliverPadding(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24)),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// One commission: the amount, the client and contract, what the rate was
/// taken on, the status, and where it is on the way to being paid.
class CommissionCard extends StatelessWidget {
  const CommissionCard({super.key, required this.commission});
  final BrokerCommission commission;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final c = commission;
    final (tone, icon, label) = switch (c.status) {
      'APPROVED' => (catalogAvailable, Icons.verified_rounded, l10n.bonusStatusApproved),
      'REJECTED' => (const Color(0xFFB3261E), Icons.block_rounded, l10n.bkStRejected),
      'CANCELLED' => (const Color(0xFF9A9083), Icons.cancel_rounded, l10n.bkStCancelled),
      _ => (catalogReserved, Icons.hourglass_top_rounded, l10n.bonusStatusPending),
    };
    final net = double.tryParse(c.netAmount ?? c.grossAmount ?? '') ?? 0;
    final basis = double.tryParse(c.basisAmount ?? '');
    final pct = double.tryParse(c.commissionPct ?? '');
    final foot = c.payoutId != null ? l10n.bkOnPayout : (c.status == 'APPROVED' ? l10n.bkWaitingPayout : '');
    return BxTileCard(
      inkKey: Key('commission-${c.id}'),
      onTap: c.contractId == null ? null : () => context.push('/broker/contracts/${c.contractId}'),
      icon: icon,
      title: c.clientName ?? c.projectName ?? l10n.navCommissions,
      subtitle: [
        if (c.contractNumber != null) ltr(c.contractNumber!),
        if (basis != null && pct != null) context.l10n.bnBasisLine(ltr(contractMoney(basis)), ltr('${pct % 1 == 0 ? pct.toInt() : pct}%')),
      ].join(' · '),
      trailing: BxPill(label, tone),
      strip: Row(children: [
        Expanded(
          child: Text.rich(TextSpan(children: [
            TextSpan(text: contractMoney(net), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            TextSpan(text: ' $currency', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          ])),
        ),
        Flexible(
          child: Text(
            [if (c.earnedAt != null) l10n.bkEarnedOn(DateFormatter.dayMonth(c.earnedAt!.toLocal(), languageCode: lang)), if (foot.isNotEmpty) foot].join(' · '),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12, color: colors.inkMuted),
          ),
        ),
      ]),
    );
  }
}

class _PayoutCard extends StatelessWidget {
  const _PayoutCard({required this.payout});
  final BrokerPayout payout;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final p = payout;
    final (tone, label) = switch (p.status) {
      'PAID' => (catalogAvailable, l10n.bkPoPaid),
      'PROCESSING' => (const Color(0xFF26405F), l10n.bkPoProcessing),
      'APPROVED' => (const Color(0xFF2A6FB0), l10n.bkPoApproved),
      'CANCELLED' => (const Color(0xFF9A9083), l10n.bkPoCancelled),
      _ => (catalogReserved, l10n.bkPoDraft),
    };
    final sub = [
      if (p.period != null) ltr(p.period!),
      if (p.status == 'PAID' && p.paidAt != null) l10n.bkPaidOn(DateFormatter.dayMonth(p.paidAt!, languageCode: lang)),
      if (p.method == 'BANK_TRANSFER') l10n.bkMethodBank,
    ].join(' · ');
    return BxTileCard(
      key: Key('payout-${p.id}'),
      icon: Icons.account_balance_rounded,
      title: p.number == null ? '—' : ltr(p.number!),
      subtitle: sub,
      trailing: BxPill(label, tone),
      strip: Text.rich(TextSpan(children: [
        TextSpan(text: contractMoney(p.totalNet), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: colors.inkStrong)),
        TextSpan(text: ' $currency', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
      ])),
    );
  }
}
