import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../domain/entities/bonus_entry.dart';
import '../cubit/bonus_cubit.dart';

/// «مستحقاتي» (design b1, owner-approved 2026-11-05): the rep's commissions and
/// bonuses: the total, what is waiting, what was paid; by status; a card each.
class BonusScreen extends StatefulWidget {
  const BonusScreen({super.key});

  @override
  State<BonusScreen> createState() => _BonusScreenState();
}

class _BonusScreenState extends State<BonusScreen> {
  String? _status;

  @override
  void initState() {
    super.initState();
    context.read<BonusCubit>().load();
  }

  void _pick(String? s) => setState(() => _status = _status == s ? null : s);

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BonusCubit>();
    final currency = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<BonusCubit, BonusState>(
          builder: (context, state) {
            final all = state.entries;
            final ready = state.status == DataStatus.success || state.status == DataStatus.empty;
            int count(String s) => all.where((e) => e.status == s).length;
            final shown = all.where((e) => _status == null || e.status == _status).toList();
            final o = state.overview;
            final total = homeCompact(o.paidTotal + o.pendingTotal, l10n);
            final pending = homeCompact(o.pendingTotal, l10n);
            final paid = homeCompact(o.paidTotal, l10n);
            String unit(String u) => [if (u.isNotEmpty) u, currency].join(' ');
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(child: HomeListHero(title: l10n.bonusTitle, subtitle: l10n.bnSubtitle, back: true)),
                  if (ready && all.isNotEmpty) ...[
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 16),
                        child: DvHeroStats(
                          id: 'total',
                          label: l10n.bnTotal,
                          value: total.$1,
                          unit: unit(total.$2),
                          figures: [
                            DvStat(id: 'pending', label: l10n.bonusPending, value: pending.$1, unit: pending.$2, warn: o.pendingTotal > 0),
                            DvStat(id: 'paid', label: l10n.bonusPaid, value: paid.$1, unit: paid.$2),
                          ],
                        ),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: DvTabs<String>(
                        keyPrefix: 'bonus-filter',
                        selected: _status ?? 'all',
                        onChanged: (v) => _pick(v == 'all' ? null : v),
                        tabs: [
                          ('all', l10n.leadsFilterAll, all.length, false),
                          ('PENDING', l10n.bonusStatusPending, count('PENDING'), false),
                          ('APPROVED', l10n.bonusStatusApproved, count('APPROVED'), false),
                          ('PAID', l10n.bonusStatusPaid, count('PAID'), false),
                        ],
                      ),
                    ),
                  ],
                  ...switch (state.status) {
                    DataStatus.initial || DataStatus.loading when all.isEmpty => [const SliverToBoxAdapter(child: SizedBox(height: 500, child: StaffListSkeleton()))],
                    DataStatus.failure when all.isEmpty => [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: cubit.load))],
                    DataStatus.empty => [SliverToBoxAdapter(child: EmptyState(icon: Icons.savings_rounded, title: l10n.bonusEmptyTitle, message: l10n.bonusEmptyMessage))],
                    _ when shown.isEmpty => [SliverToBoxAdapter(child: EmptyState(icon: Icons.filter_list_off_rounded, title: l10n.pmNoMatch))],
                    _ => [
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                          sliver: SliverToBoxAdapter(
                            child: Container(
                              decoration: homeCard(context, radius: 22),
                              clipBehavior: Clip.antiAlias,
                              child: Material(
                                color: Colors.transparent,
                                child: Column(children: [
                                  for (final (i, e) in shown.indexed) ...[
                                    if (i > 0) Divider(height: 1, thickness: 1, indent: 16, endIndent: 16, color: context.appColors.hairline),
                                    BonusCard(entry: e),
                                  ],
                                ]),
                              ),
                            ),
                          ),
                        ),
                      ],
                  },
                  SliverPadding(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// One commission or bonus: the amount and the rule, what it was taken on,
/// its status, and when it is counted or was paid.
class BonusCard extends StatelessWidget {
  const BonusCard({super.key, required this.entry});
  final BonusEntry entry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final e = entry;
    final (tone, icon, label) = switch (e.status) {
      'PAID' => (catalogAvailable, Icons.paid_rounded, l10n.bonusStatusPaid),
      'APPROVED' => (const Color(0xFF2A6FB0), Icons.verified_rounded, l10n.bonusStatusApproved),
      _ => (catalogReserved, Icons.hourglass_top_rounded, l10n.bonusStatusPending),
    };
    final basis = double.tryParse(e.basisAmount ?? '');
    final pct = double.tryParse(e.commissionPct ?? '');
    final amount = double.tryParse(e.amount) ?? 0;
    final foot = switch (e.status) {
      'PAID' => e.paidAt == null ? '' : l10n.bnPaidOn(DateFormatter.dayMonth(e.paidAt!.toLocal(), languageCode: lang)),
      'APPROVED' => l10n.bnApprovedNote,
      _ => l10n.bnWhenSigned,
    };
    final dv = switch (e.status) {
      'PAID' => DvTone.ok,
      'APPROVED' => DvTone.neutral,
      _ => DvTone.warn,
    };
    return InkWell(
      key: Key('bonus-${e.id}'),
      onTap: e.contractId == null ? null : () => context.push('/contracts/${e.contractId}'),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: colors.inkStrong, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(e.ruleName ?? l10n.bonusTitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.inkStrong)),
              if (basis != null && pct != null) ...[
                const SizedBox(height: 3),
                Text(l10n.bnBasisLine(ltr(contractMoney(basis)), ltr('${pct % 1 == 0 ? pct.toInt() : pct}%')), style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
              ],
              const SizedBox(height: 3),
              Text([l10n.bnPeriodLine(ltr(e.period)), if (foot.isNotEmpty) foot].join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
            ]),
          ),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text.rich(TextSpan(children: [
              TextSpan(text: contractMoney(amount), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: colors.inkStrong)),
              TextSpan(text: ' $currency', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
            ])),
            const SizedBox(height: 6),
            DvPill(label, tone: dv, small: true),
          ]),
        ]),
      ),
    );
  }
}
