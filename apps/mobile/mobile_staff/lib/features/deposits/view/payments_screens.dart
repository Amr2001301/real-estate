import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/staff_list_skeleton.dart';
import '../../contracts/view/contract_page_screen.dart' show KvTable;
import '../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../reservations/view/reservation_page_screen.dart' show ReservationLinkCard;
import 'payments_data.dart';

const _muted = Color(0xFF6B6256);

String paymentKind(AppLocalizations l10n, PaymentRow p) => switch (p.type) {
      'BOOKING_AMOUNT' => l10n.depositTypeBooking,
      'DOWN_PAYMENT' => l10n.depositTypeDownPayment,
      'INSTALLMENT' => l10n.depositTypeInstallment,
      'FINAL_PAYMENT' => l10n.depositTypeFinal,
      'FEE' => l10n.depositTypeFee,
      _ => l10n.depositTypePayment,
    };

String? paymentMethod(AppLocalizations l10n, PaymentRow p) => switch (p.method) {
      'CASH' => l10n.pmMethodCash,
      'BANK_TRANSFER' => l10n.pmMethodBank,
      'CHEQUE' => p.chequeNumber == null ? l10n.pmMethodCheque : l10n.pmChequeN(ltr(p.chequeNumber!)),
      _ => null,
    };

/// The state's color and icon, shared by the card, the page and the pills.
(Color, IconData) paymentTone(PaymentRow p) => switch (p.state) {
      'COLLECTED' => (catalogAvailable, Icons.verified_rounded),
      'PENDING_REVIEW' => (catalogReserved, Icons.hourglass_top_rounded),
      'CHEQUE_PENDING' => (AppPalette.gold600, Icons.receipt_long_rounded),
      'REJECTED' || 'BOUNCED' => (const Color(0xFFB3261E), Icons.block_rounded),
      _ => (_muted, Icons.undo_rounded),
    };

String paymentStateLabel(AppLocalizations l10n, PaymentRow p) => switch (p.state) {
      'COLLECTED' => l10n.depositStateCollected,
      'PENDING_REVIEW' => l10n.depositStatePendingReview,
      'CHEQUE_PENDING' => l10n.depositStateChequePending,
      'REJECTED' => l10n.depositStateRejected,
      'BOUNCED' => l10n.depositStateBounced,
      _ => l10n.depositStateReversed,
    };

Widget paymentBadge(AppLocalizations l10n, PaymentRow p) {
  final (c, i) = paymentTone(p);
  return CatalogBadge.status(paymentStateLabel(l10n, p), c, icon: i);
}

Future<String?> askPaymentRejectReason(BuildContext context) async {
  final l10n = context.l10n;
  final controller = TextEditingController();
  final formKey = GlobalKey<FormState>();
  final reason = await showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(l10n.paymentRejectReason),
      content: Form(
        key: formKey,
        child: TextFormField(
          key: const Key('payment-reject-reason'),
          controller: controller,
          autofocus: true,
          maxLength: 2000,
          maxLines: 3,
          decoration: InputDecoration(hintText: l10n.paymentRejectReason),
          validator: (v) => (v == null || v.trim().isEmpty) ? l10n.paymentReasonRequired : null,
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l10n.actionCancel)),
        TextButton(
          key: const Key('payment-reject-confirm'),
          onPressed: () {
            if (formKey.currentState?.validate() ?? false) Navigator.pop(ctx, controller.text.trim());
          },
          child: Text(l10n.paymentReject),
        ),
      ],
    ),
  );
  controller.dispose();
  return reason;
}

Future<bool> confirmPaymentApprove(BuildContext context) async {
  final l10n = context.l10n;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(l10n.pmDecisionTitleApprove),
      content: Text(l10n.pmDecisionApproveBody),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l10n.actionCancel)),
        TextButton(key: const Key('payment-approve-confirm'), onPressed: () => Navigator.pop(ctx, true), child: Text(l10n.paymentApprove)),
      ],
    ),
  );
  return ok ?? false;
}

Future<void> _openProof(BuildContext context, Future<Result<String>> Function() link) async {
  final l10n = context.l10n;
  final messenger = ScaffoldMessenger.of(context);
  final r = await link();
  String? url;
  AppFailure? failure;
  r.when(ok: (u) => url = u, err: (f) => failure = f);
  if (url == null) {
    messenger.showSnackBar(SnackBar(content: Text(failure?.type == FailureType.notFound ? l10n.paymentProofUnavailable : (failure?.userMessage(l10n) ?? l10n.paymentProofUnavailable))));
    return;
  }
  if (!await ContactActions.openExternal(url!)) messenger.showSnackBar(SnackBar(content: Text(l10n.paymentCouldNotOpenProof)));
}

/// The payments list (design p1, owner-approved 2026-11-05): the collected
/// total, what needs review, the cheques waiting; by state; a card each.
class PaymentsListScreen extends StatefulWidget {
  const PaymentsListScreen({super.key});

  @override
  State<PaymentsListScreen> createState() => _PaymentsListScreenState();
}

class _PaymentsListScreenState extends State<PaymentsListScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<PaymentsListCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<PaymentsListCubit>();
    final currency = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<PaymentsListCubit, PaymentsListState>(
          builder: (context, state) {
            final all = state.all;
            final ready = state.data.status == DataStatus.success || state.data.status == DataStatus.empty;
            final shown = state.shown;
            final review = state.count(PaymentGroup.review);
            final cheques = state.count(PaymentGroup.cheque);
            // The number alone is the big figure; «مليون ج.م» goes under it.
            final collected = homeCompact(state.totals.amount, l10n);
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.navDeposits,
                      subtitle: ready ? l10n.pmCountN(all.length) : null,
                      back: true,
                      bottom: HomeSearchField(
                        controller: _search,
                        hint: l10n.pmSearchHint,
                        onSubmitted: cubit.setSearch,
                        onClear: () {
                          _search.clear();
                          cubit.setSearch('');
                        },
                      ),
                    ),
                  ),
                  if (ready && all.isNotEmpty) ...[
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: HomeBand(figures: [
                          HomeFigure(id: 'collected', value: collected.$1, label: l10n.pmCollected, hint: [if (collected.$2.isNotEmpty) collected.$2, currency].join(' ')),
                          HomeFigure(id: 'review', value: '$review', label: l10n.pmNeedReview, hint: l10n.pmNeedReviewHint, warn: review > 0),
                          HomeFigure(id: 'cheques', value: '$cheques', label: l10n.pmChequesWaiting, hint: l10n.pmChequesHint, warn: cheques > 0),
                        ]),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 14),
                        child: HomePills(pills: [
                          HomePill(id: 'all', label: l10n.lvAll, count: all.length, selected: state.filter == null, onTap: () => cubit.setFilter(null)),
                          HomePill(
                            id: 'review',
                            label: l10n.pmPillReview,
                            count: review,
                            dot: catalogReserved,
                            selected: state.filter == PaymentGroup.review,
                            onTap: () => cubit.setFilter(PaymentGroup.review),
                          ),
                          HomePill(
                            id: 'cheque',
                            label: l10n.pmPillCheque,
                            count: cheques,
                            dot: AppPalette.gold500,
                            selected: state.filter == PaymentGroup.cheque,
                            onTap: () => cubit.setFilter(PaymentGroup.cheque),
                          ),
                          HomePill(
                            id: 'collected',
                            label: l10n.pmPillCollected,
                            count: state.count(PaymentGroup.collected),
                            dot: catalogAvailable,
                            selected: state.filter == PaymentGroup.collected,
                            onTap: () => cubit.setFilter(PaymentGroup.collected),
                          ),
                          HomePill(
                            id: 'closed',
                            label: l10n.pmPillClosed,
                            count: state.count(PaymentGroup.closed),
                            dot: _muted,
                            selected: state.filter == PaymentGroup.closed,
                            onTap: () => cubit.setFilter(PaymentGroup.closed),
                          ),
                        ]),
                      ),
                    ),
                  ],
                  ...switch (state.data.status) {
                    DataStatus.initial || DataStatus.loading when state.all.isEmpty => [const SliverToBoxAdapter(child: SizedBox(height: 600, child: StaffListSkeleton()))],
                    DataStatus.failure when state.all.isEmpty => [SliverToBoxAdapter(child: ErrorState(failure: state.data.failure, onRetry: cubit.load))],
                    DataStatus.empty => [SliverToBoxAdapter(child: EmptyState(icon: Icons.receipt_long_rounded, title: l10n.pmEmpty, message: l10n.pmEmptyMessage))],
                    _ when shown.isEmpty => [SliverToBoxAdapter(child: EmptyState(icon: Icons.filter_list_off_rounded, title: l10n.pmNoMatch))],
                    _ => [
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                          sliver: SliverList.separated(
                            itemCount: shown.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (context, i) => PaymentCardView(row: shown[i], working: state.workingId == shown[i].id),
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

/// One payment: the client and the amount, the reference and unit, the state
/// and how it was paid, and what is next (approve or reject a proof; open
/// the cheque).
class PaymentCardView extends StatelessWidget {
  const PaymentCardView({super.key, required this.row, this.working = false});
  final PaymentRow row;
  final bool working;

  Future<void> _decide(BuildContext context, {required bool approve}) async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    String? reason;
    if (approve) {
      if (!await confirmPaymentApprove(context)) return;
    } else {
      reason = await askPaymentRejectReason(context);
      if (reason == null) return;
    }
    if (!context.mounted) return;
    final f = await context.read<PaymentsListCubit>().decide(row.id, approve: approve, reason: reason);
    messenger.showSnackBar(SnackBar(content: Text(f?.userMessage(l10n) ?? (approve ? l10n.paymentApproved : l10n.paymentRejected))));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final isAdmin = context.read<SessionCubit>().state.role == AppRole.admin;
    final (tone, icon) = paymentTone(row);
    String day(DateTime d) => DateFormatter.dayMonth(d, languageCode: lang);
    final kind = [paymentKind(l10n, row), if (paymentMethod(l10n, row) != null) paymentMethod(l10n, row)!].join(' · ');
    final canDecide = isAdmin && row.state == 'PENDING_REVIEW';

    final List<Widget> foot = switch (row.state) {
      'PENDING_REVIEW' => [
          if (row.hasProof) Text(l10n.pmProofAttached, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          const Spacer(),
          if (row.paidAt != null) Text(l10n.pmPaidOn(day(row.paidAt!)), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        ],
      'CHEQUE_PENDING' => [
          if (row.dueDate != null) Text(l10n.pmDueOn(day(row.dueDate!)), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          const Spacer(),
          if (row.instrumentId != null)
            InkWell(
              key: Key('payment-cheque-${row.id}'),
              onTap: () => context.push('/cheques/${row.instrumentId}'),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(l10n.pmOpenCheque, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.gold600)),
                Icon(Icons.chevron_right_rounded, size: 17, color: AppPalette.gold600),
              ]),
            ),
        ],
      'REJECTED' || 'BOUNCED' => [
          Expanded(
            child: Text(
              (row.rejectionReason ?? '').isNotEmpty ? l10n.pmReasonLine(row.rejectionReason!) : (row.paidAt == null ? '' : day(row.paidAt!)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, color: tone),
            ),
          ),
        ],
      _ => [
          if (row.paidAt != null) Text(l10n.pmPaidOn(day(row.paidAt!)), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        ],
    };

    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: Key('payment-card-${row.id}'),
        onTap: () => context.push('/deposits/${row.id}', extra: row),
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: colors.hairline)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: tone.withValues(alpha: 0.13), borderRadius: BorderRadius.circular(14)),
                  child: Icon(icon, color: tone, size: 22),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(
                        child: Text(row.clientName ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                      ),
                      const SizedBox(width: 6),
                      Text.rich(TextSpan(children: [
                        TextSpan(text: contractMoney(row.amount), style: homeDisplay(16, colors.inkStrong)),
                        TextSpan(text: ' $currency', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                      ])),
                    ]),
                    const SizedBox(height: 2),
                    Text.rich(
                      TextSpan(children: [
                        if (row.reference != null) TextSpan(text: ltr(row.reference!), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.gold600)),
                        if ((row.unitCode ?? '').isNotEmpty) TextSpan(text: ' · ${ltr(row.unitCode!)}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                      ]),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 5),
                    Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                      paymentBadge(l10n, row),
                      Text(kind, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    ]),
                  ]),
                ),
              ]),
            ),
            if (canDecide)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                child: Row(children: [
                  Expanded(
                    child: FilledButton.icon(
                      key: Key('payment-approve-${row.id}'),
                      onPressed: working ? null : () => _decide(context, approve: true),
                      icon: working ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check_rounded, size: 18),
                      label: Text(l10n.paymentApprove, maxLines: 1, overflow: TextOverflow.ellipsis),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(42),
                        backgroundColor: catalogAvailable,
                        foregroundColor: Colors.white,
                        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      key: Key('payment-reject-${row.id}'),
                      onPressed: working ? null : () => _decide(context, approve: false),
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: Text(l10n.paymentReject, maxLines: 1, overflow: TextOverflow.ellipsis),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(42),
                        foregroundColor: colors.error,
                        side: BorderSide(color: colors.error.withValues(alpha: 0.45), width: 1.4),
                        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                      ),
                    ),
                  ),
                ]),
              ),
            if (foot.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
                decoration: BoxDecoration(color: colors.surfaceSoft, border: Border(top: BorderSide(color: colors.hairline))),
                child: Row(children: foot),
              ),
          ]),
        ),
      ),
    );
  }
}

/// One payment's page (design p2): the amount and its journey, the proof or
/// the cheque, the contract and instalment, and the decision for the admin.
class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    context.read<PaymentCubit>().load();
  }

  Future<void> _decide({required bool approve}) async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final cubit = context.read<PaymentCubit>();
    String? reason;
    if (approve) {
      if (!await confirmPaymentApprove(context)) return;
    } else {
      reason = await askPaymentRejectReason(context);
      if (reason == null) return;
    }
    if (!mounted) return;
    setState(() => _busy = true);
    final f = await cubit.decide(approve: approve, reason: reason);
    if (!mounted) return;
    setState(() => _busy = false);
    messenger.showSnackBar(SnackBar(content: Text(f?.userMessage(l10n) ?? (approve ? l10n.paymentApproved : l10n.paymentRejected))));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final isAdmin = context.read<SessionCubit>().state.role == AppRole.admin;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<PaymentCubit, DataState<PaymentRow>>(
          builder: (context, state) {
            final p = state.data;
            if (p == null) {
              return Column(children: [
                const HomeListHero(title: '', back: true),
                Expanded(
                  child: state.status == DataStatus.failure
                      ? ErrorState(failure: state.failure, onRetry: context.read<PaymentCubit>().load)
                      : const KitDetailSkeleton(heroHeight: 0, facts: 5),
                ),
              ]);
            }
            final (tone, _) = paymentTone(p);
            String day(DateTime? d) => d == null ? '' : DateFormatter.dayMonth(d, languageCode: lang);
            final cheque = p.method == 'CHEQUE';
            final review = p.state == 'PENDING_REVIEW';
            // The journey: recorded → review → (clearing) → collected.
            final failed = p.state == 'REJECTED' || p.state == 'BOUNCED' || p.state == 'REVERSED';
            final steps = <(String, String, bool)>[
              (l10n.pmStRecorded, day(p.paidAt), true),
              if (cheque)
                (l10n.pmStCleared, day(p.dueDate), p.state == 'COLLECTED')
              else
                (l10n.pmStReview, '', !review),
              (l10n.pmStCollected, '', p.state == 'COLLECTED'),
            ];
            final now = failed ? -1 : steps.indexWhere((s) => !s.$3);
            final canDecide = isAdmin && review;
            return Column(children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: context.read<PaymentCubit>().load,
                  child: ListView(padding: EdgeInsets.only(bottom: canDecide ? 16 : MediaQuery.paddingOf(context).bottom + 24), children: [
                    HomeOverlap(
                      overlap: 44,
                      top: HomeListHero(
                        title: paymentKind(l10n, p),
                        subtitle: [if ((p.clientName ?? '').isNotEmpty) p.clientName!, if ((p.unitCode ?? '').isNotEmpty) ltr(p.unitCode!)].join(' · '),
                        back: true,
                        bottom: Padding(
                          padding: const EdgeInsets.only(bottom: 48),
                          child: Wrap(spacing: 6, runSpacing: 6, children: [
                            paymentBadge(l10n, p),
                            if (paymentMethod(l10n, p) != null) CatalogBadge.glass(paymentMethod(l10n, p)!),
                          ]),
                        ),
                      ),
                      bottom: Container(
                        margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: colors.surface,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: homeLine(context)),
                          boxShadow: const [BoxShadow(color: Color(0x290F1E33), blurRadius: 40, offset: Offset(0, 18))],
                        ),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          Text(l10n.depositAmount, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                          Text.rich(
                            key: const Key('payment-amount'),
                            TextSpan(children: [
                              TextSpan(text: contractMoney(p.amount), style: homeDisplay(28, colors.inkStrong)),
                              TextSpan(text: ' $currency', style: TextStyle(fontSize: 13, color: colors.inkMuted)),
                            ]),
                          ),
                          if (p.state == 'CHEQUE_PENDING')
                            Text(l10n.pmNotCounted, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppPalette.gold600))
                          else if (p.state == 'COLLECTED' && p.paidAt != null)
                            Text('✓ ${l10n.pmPaidOn(DateFormatter.mediumDate(p.paidAt!, languageCode: lang))}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: catalogAvailable))
                          else if ((p.rejectionReason ?? '').isNotEmpty)
                            Text(l10n.pmReasonLine(p.rejectionReason!), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: tone)),
                          const SizedBox(height: 14),
                          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            for (final (i, (label, at, done)) in steps.indexed)
                              Expanded(
                                child: Column(children: [
                                  Container(
                                    key: Key('payment-step-$i'),
                                    width: 26,
                                    height: 26,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: done ? catalogAvailable : (i == now ? AppPalette.gold400 : (failed && i == steps.length - 1 ? const Color(0xFF9A9083) : homeLine(context))),
                                      boxShadow: i == now ? [BoxShadow(color: homeTint(context), spreadRadius: 4)] : null,
                                    ),
                                    child: Icon(
                                      done ? Icons.check_rounded : (failed && i == steps.length - 1 ? Icons.close_rounded : Icons.more_horiz_rounded),
                                      size: 15,
                                      color: done || (failed && i == steps.length - 1) ? Colors.white : (i == now ? AppPalette.navy : const Color(0xFF9A9083)),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                                  Text(i == now ? l10n.pmNow : at, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                                ]),
                              ),
                          ]),
                        ]),
                      ),
                    ),
                    if (cheque)
                      HomeSection(
                        icon: Icons.receipt_long_rounded,
                        title: l10n.pmCheque,
                        child: Column(children: [
                          KvTable(rows: [
                            (l10n.pmChequeNo, ltr(p.chequeNumber ?? '—')),
                            (l10n.pmChequeState, paymentStateLabel(l10n, p)),
                          ]),
                          if (p.instrumentId != null) ...[
                            const SizedBox(height: 8),
                            ReservationLinkCard(
                              key: const Key('payment-open-cheque'),
                              icon: Icons.open_in_new_rounded,
                              title: l10n.pmOpenChequePage,
                              onTap: () => context.push('/cheques/${p.instrumentId}'),
                            ),
                          ],
                        ]),
                      ),
                    if (p.hasProof)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: ReservationLinkCard(
                          key: const Key('payment-open-proof'),
                          icon: Icons.attach_file_rounded,
                          title: l10n.paymentOpenProof,
                          subtitle: l10n.paymentProofAttached,
                          onTap: () => _openProof(context, context.read<PaymentCubit>().proof),
                        ),
                      ),
                    HomeSection(
                      icon: Icons.description_rounded,
                      title: l10n.pmContractInstallment,
                      child: Column(children: [
                        KvTable(rows: [
                          (p.contractNumber != null ? l10n.pmContract : l10n.pmBooking, ltr(p.reference ?? '—')),
                          (l10n.pmClient, p.clientName ?? '—'),
                          if (p.dueDate != null) (l10n.pmInstallmentDue, DateFormatter.mediumDate(p.dueDate!, languageCode: lang)),
                          if (p.installmentAmount != null) (l10n.pmInstallmentAmount, '${contractMoney(p.installmentAmount!)} $currency'),
                        ]),
                        if (p.contractId != null) ...[
                          const SizedBox(height: 8),
                          ReservationLinkCard(
                            key: const Key('payment-open-contract'),
                            icon: Icons.description_rounded,
                            title: l10n.rbOpenContract,
                            onTap: () => context.push('/contracts/${p.contractId}'),
                          ),
                        ],
                      ]),
                    ),
                    if (p.state == 'REVERSED')
                      Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: Text(
                          [
                            l10n.pmReversedNote([if (p.reversedAt != null) ' ${day(p.reversedAt)}', if ((p.reversedBy ?? '').isNotEmpty) ' · ${p.reversedBy}'].join()),
                            if ((p.reversalReason ?? '').isNotEmpty) l10n.pmReasonLine(p.reversalReason!),
                          ].join('\n'),
                          style: TextStyle(fontSize: 12, color: colors.inkMuted, height: 1.6),
                        ),
                      ),
                  ]),
                ),
              ),
              if (canDecide)
                Container(
                  padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.paddingOf(context).bottom),
                  decoration: BoxDecoration(color: colors.canvas, border: Border(top: BorderSide(color: colors.hairline))),
                  child: Row(children: [
                    Expanded(
                      flex: 2,
                      child: OutlinedButton.icon(
                        key: const Key('payment-reject'),
                        onPressed: _busy ? null : () => _decide(approve: false),
                        icon: const Icon(Icons.close_rounded, size: 18),
                        label: Text(l10n.paymentReject, maxLines: 1, softWrap: false, overflow: TextOverflow.ellipsis),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                          foregroundColor: colors.error,
                          side: BorderSide(color: colors.error.withValues(alpha: 0.45), width: 1.4),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 3,
                      child: FilledButton.icon(
                        key: const Key('payment-approve'),
                        onPressed: _busy ? null : () => _decide(approve: true),
                        icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check_rounded, size: 19),
                        label: Text(l10n.paymentApprove),
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                          backgroundColor: catalogAvailable,
                          foregroundColor: Colors.white,
                          textStyle: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                        ),
                      ),
                    ),
                  ]),
                ),
            ]);
          },
        ),
      ),
    );
  }
}
