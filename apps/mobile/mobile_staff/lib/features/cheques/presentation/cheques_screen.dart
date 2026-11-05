import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/staff_list_skeleton.dart';
import '../../catalog/kit/catalog_kit.dart';
import '../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../dashboard/home_kit/home_kit.dart';
import '../../leads/presentation/follow_up_labels.dart';
import '../domain/cheque.dart';
import 'cheques_cubit.dart';

String chequeStatusLabel(AppLocalizations l10n, String status) => switch (status) {
      'PENDING_CLEARANCE' => l10n.chequeStatusPending,
      'DEPOSITED' => l10n.chequeStatusDeposited,
      'CLEARED' => l10n.chequeStatusCleared,
      'BOUNCED' => l10n.chequeStatusBounced,
      'REPLACED' => l10n.chequeStatusReplaced,
      'CANCELLED' => l10n.chequeStatusCancelled,
      _ => status,
    };

BadgeTone chequeStatusTone(String status) => switch (status) {
      'PENDING_CLEARANCE' => BadgeTone.warning,
      'DEPOSITED' => BadgeTone.info,
      'CLEARED' => BadgeTone.success,
      'BOUNCED' => BadgeTone.error,
      _ => BadgeTone.neutral,
    };

Color chequeStatusColor(String status, AppColorsExt c) => switch (status) {
      'PENDING_CLEARANCE' => c.warning,
      'DEPOSITED' => c.info,
      'CLEARED' => c.success,
      'BOUNCED' => c.error,
      _ => c.inkMuted,
    };

String chequeMoney(num? amount, String lang) =>
    amount == null ? '—' : latinDigits(PriceFormatter.format(amount, languageCode: lang));

/// «الشيكات» (design c1, owner-approved 2026-11-05): customers' cheques by
/// status, soonest due first, as on the dashboard. Admin and sales manager.
class ChequesScreen extends StatefulWidget {
  const ChequesScreen({super.key});

  @override
  State<ChequesScreen> createState() => _ChequesScreenState();
}

class _ChequesScreenState extends State<ChequesScreen> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<ChequesCubit>().load();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) {
        context.read<ChequesCubit>().loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ChequesCubit>();
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<ChequesCubit, ChequesState>(
          builder: (context, state) {
            final ready = state.status == DataStatus.success || state.status == DataStatus.empty;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                controller: _scroll,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.chequesTitle,
                      subtitle: ready ? l10n.cqCountN(state.total) : null,
                      back: true,
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 14),
                      child: HomePills(pills: [
                        for (final s in kChequeStatuses)
                          HomePill(
                            id: s,
                            label: chequeStatusLabel(l10n, s),
                            dot: _tone(s),
                            selected: state.filter == s,
                            onTap: () => cubit.setFilter(s),
                          ),
                        HomePill(id: 'all', label: l10n.leadsFilterAll, selected: state.filter == null, onTap: () => cubit.setFilter(null)),
                      ]),
                    ),
                  ),
                  ...switch (state.status) {
                    DataStatus.initial || DataStatus.loading => [const SliverToBoxAdapter(child: SizedBox(height: 500, child: StaffListSkeleton()))],
                    DataStatus.failure => [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: cubit.load))],
                    DataStatus.empty => [SliverToBoxAdapter(child: EmptyState(icon: Icons.receipt_long_outlined, title: l10n.chequesEmpty, message: l10n.chequesEmptyHint))],
                    DataStatus.success => [
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                          sliver: SliverList.separated(
                            itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (context, i) {
                              if (i >= state.items.length) return const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Center(child: CircularProgressIndicator()));
                              final c = state.items[i];
                              return ChequeCardView(
                                cheque: c,
                                onTap: () async {
                                  await context.push('/cheques/${c.id}', extra: c);
                                  // A deposit or clearing recorded there moves it.
                                  if (context.mounted) await cubit.load();
                                },
                              );
                            },
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

  Color _tone(String s) => switch (s) {
        'PENDING_CLEARANCE' => AppPalette.gold500,
        'DEPOSITED' => const Color(0xFF26405F),
        'CLEARED' => const Color(0xFF3E7C5A),
        'BOUNCED' => const Color(0xFFB3261E),
        _ => const Color(0xFF9A9083),
      };
}

/// One cheque: the client and the amount, the contract and number, the bank,
/// the state, and the due date (red once it is time to take it to the bank).
class ChequeCardView extends StatelessWidget {
  const ChequeCardView({super.key, required this.cheque, required this.onTap});
  final Cheque cheque;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final c = cheque;
    final tone = chequeStatusColor(c.status, colors);
    final dueNow = c.dueForDeposit(DateTime.now());
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: ValueKey('cheque-${c.id}'),
        onTap: onTap,
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
                  child: Icon(Icons.receipt_long_rounded, color: tone, size: 22),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(c.customer ?? (c.number != null ? ltr('#${c.number}') : l10n.chequesTitle), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong))),
                      const SizedBox(width: 6),
                      Text.rich(TextSpan(children: [
                        TextSpan(text: c.amount == null ? '—' : contractMoney(c.amount!.toDouble()), style: homeDisplay(16, colors.inkStrong)),
                        TextSpan(text: ' $currency', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                      ])),
                    ]),
                    const SizedBox(height: 2),
                    Text.rich(
                      TextSpan(children: [
                        if (c.contractNumber != null) TextSpan(text: ltr(c.contractNumber!), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.gold600)),
                        if (c.number != null) TextSpan(text: ' · ${l10n.chequeNumberLabel} ${ltr(c.number!)}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                        if (c.bank != null) TextSpan(text: ' · ${c.bank}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                      ]),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 5),
                    Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                      CatalogBadge.status(chequeStatusLabel(l10n, c.status), tone),
                      if (dueNow) Text(l10n.chequeDueForDeposit, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: colors.error)),
                    ]),
                  ]),
                ),
              ]),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
              decoration: BoxDecoration(color: colors.surfaceSoft, border: Border(top: BorderSide(color: colors.hairline))),
              child: Row(children: [
                if (c.dueDate != null) Text(l10n.pmDueOn(followUpDate(c.dueDate!, lang)), style: TextStyle(fontSize: 12, color: dueNow ? colors.error : colors.inkMuted)),
                const Spacer(),
                Icon(Icons.chevron_right_rounded, size: 18, color: colors.inkMuted),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
