import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../catalog/kit/catalog_kit.dart';
import '../../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../../dashboard/home_kit/home_kit.dart';
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
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: HomeBand(figures: [
                          HomeFigure(id: 'total', value: total.$1, label: l10n.bnTotal, hint: unit(total.$2)),
                          HomeFigure(id: 'pending', value: pending.$1, label: l10n.bonusPending, hint: [if (pending.$2.isNotEmpty) pending.$2, l10n.bnPendingHint].join(' · '), warn: o.pendingTotal > 0),
                          HomeFigure(id: 'paid', value: paid.$1, label: l10n.bonusPaid, hint: [if (paid.$2.isNotEmpty) paid.$2, l10n.bnPaidHint].join(' · ')),
                        ]),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 14),
                        child: HomePills(pills: [
                          HomePill(id: 'all', label: l10n.leadsFilterAll, count: all.length, selected: _status == null, onTap: () => _pick(null)),
                          HomePill(id: 'PENDING', label: l10n.bonusStatusPending, count: count('PENDING'), dot: catalogReserved, selected: _status == 'PENDING', onTap: () => _pick('PENDING')),
                          HomePill(id: 'APPROVED', label: l10n.bonusStatusApproved, count: count('APPROVED'), dot: const Color(0xFF2A6FB0), selected: _status == 'APPROVED', onTap: () => _pick('APPROVED')),
                          HomePill(id: 'PAID', label: l10n.bonusStatusPaid, count: count('PAID'), dot: catalogAvailable, selected: _status == 'PAID', onTap: () => _pick('PAID')),
                        ]),
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
                          sliver: SliverList.separated(
                            itemCount: shown.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (context, i) => BonusCard(entry: shown[i]),
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
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: Key('bonus-${e.id}'),
        onTap: e.contractId == null ? null : () => context.push('/contracts/${e.contractId}'),
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: colors.hairline)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(color: tone.withValues(alpha: 0.13), borderRadius: BorderRadius.circular(14)),
                  child: Icon(icon, color: tone, size: 22),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(e.ruleName ?? l10n.bonusTitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: colors.inkStrong))),
                      const SizedBox(width: 6),
                      Text.rich(TextSpan(children: [
                        TextSpan(text: contractMoney(amount), style: homeDisplay(16, colors.inkStrong)),
                        TextSpan(text: ' $currency', style: TextStyle(fontSize: 10.5, color: colors.inkMuted)),
                      ])),
                    ]),
                    if (basis != null && pct != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(l10n.bnBasisLine(ltr(contractMoney(basis)), ltr('${pct % 1 == 0 ? pct.toInt() : pct}%')), style: TextStyle(fontSize: 11.5, color: colors.inkMuted)),
                      ),
                    const SizedBox(height: 5),
                    CatalogBadge.status(label, tone, icon: icon),
                  ]),
                ),
              ]),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
              decoration: BoxDecoration(color: colors.surfaceSoft, border: Border(top: BorderSide(color: colors.hairline))),
              child: Row(children: [
                Text(l10n.bnPeriodLine(ltr(e.period)), style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                const Spacer(),
                Flexible(child: Text(foot, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: e.status == 'PENDING' ? const Color(0xFF8A5A12) : colors.inkMuted))),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
