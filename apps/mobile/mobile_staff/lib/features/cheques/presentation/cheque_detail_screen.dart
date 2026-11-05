import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/staff_list_skeleton.dart';
import '../../catalog/kit/catalog_kit.dart';
import '../../contracts/view/contract_page_screen.dart' show KvTable;
import '../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../dashboard/home_kit/home_kit.dart';
import '../../leads/presentation/follow_up_labels.dart';
import '../../reservations/view/reservation_page_screen.dart' show ReservationLinkCard;
import '../domain/cheque.dart';
import 'cheques_cubit.dart';
import 'cheques_screen.dart';

/// One cheque (design c2): the amount, its state and its road (received,
/// deposited at the bank, cleared), the cheque and whose it is, what it
/// pays; and the two steps recorded from the phone: deposited, then cleared.
/// Bouncing, cancelling and replacing stay on the dashboard.
class ChequeDetailScreen extends StatefulWidget {
  const ChequeDetailScreen({super.key});

  @override
  State<ChequeDetailScreen> createState() => _ChequeDetailScreenState();
}

class _ChequeDetailScreenState extends State<ChequeDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ChequeDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ChequeDetailCubit>();
    final row = cubit.row;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocConsumer<ChequeDetailCubit, ChequeDetailState>(
          listenWhen: (a, b) => a.actionFailure != b.actionFailure || a.done != b.done,
          listener: (context, state) {
            if (state.actionFailure != null) {
              showFailureSnackBar(context, state.actionFailure!);
            } else if (state.done != null) {
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(SnackBar(content: Text(state.done == 'clear' ? l10n.chequeClearedDone : l10n.chequeDepositedDone)));
            }
          },
          builder: (context, state) {
            final c = state.cheque;
            final number = c?.number ?? row?.number;
            final title = number != null ? '${l10n.chequeNumberLabel} ${ltr(number)}' : l10n.chequesTitle;
            if (c == null) {
              return Column(children: [
                HomeListHero(title: title, back: true),
                Expanded(child: state.status == DataStatus.failure ? ErrorState(failure: state.failure, onRetry: cubit.load) : const StaffListSkeleton(rows: 4, lines: 3)),
              ]);
            }
            return Column(children: [
              Expanded(child: RefreshIndicator(onRefresh: cubit.load, child: _Body(cheque: c, title: title))),
              if (c.canDeposit || c.canClear)
                Container(
                  padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.paddingOf(context).bottom),
                  decoration: BoxDecoration(color: context.appColors.canvas, border: Border(top: BorderSide(color: context.appColors.hairline))),
                  child: FilledButton.icon(
                    key: Key(c.canDeposit ? 'cheque-deposit' : 'cheque-clear'),
                    onPressed: state.working ? null : () => c.canDeposit ? _confirmDeposit(context) : _confirmClear(context),
                    icon: state.working
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.navy))
                        : Icon(c.canDeposit ? Icons.account_balance_rounded : Icons.task_alt_rounded, size: 19),
                    label: Text(c.canDeposit ? l10n.chequeActionDeposit : l10n.chequeActionClear),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(50),
                      backgroundColor: AppPalette.gold400,
                      foregroundColor: AppPalette.navy,
                      textStyle: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                    ),
                  ),
                ),
            ]);
          },
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.cheque, required this.title});
  final Cheque cheque;
  final String title;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final c = cheque;
    final tone = chequeStatusColor(c.status, colors);
    final dueNow = c.dueForDeposit(DateTime.now());
    String? date(DateTime? d) => d == null ? null : followUpDate(d, lang);
    String day(DateTime? d) => d == null ? '' : DateFormatter.dayMonth(d, languageCode: lang);
    final today = DateUtils.dateOnly(DateTime.now());
    String? dueLine;
    if (c.dueDate != null && (c.status == 'PENDING_CLEARANCE' || c.status == 'DEPOSITED')) {
      final days = DateUtils.dateOnly(c.dueDate!).difference(today).inDays;
      dueLine = '${date(c.dueDate)} · ${days == 0 ? l10n.cqDueToday : (days > 0 ? l10n.cqDueIn(days) : l10n.cqOverdue(-days))}';
    }
    // The road: received → deposited → cleared (a bounce ends it).
    final failed = c.status == 'BOUNCED' || c.status == 'REPLACED' || c.status == 'CANCELLED';
    final deposited = c.status != 'PENDING_CLEARANCE';
    final cleared = c.status == 'CLEARED';
    final steps = <(String, String, bool)>[
      (l10n.cqStReceived, day(c.createdAt), true),
      (l10n.cqStDeposit, '', deposited && !failed || failed && c.bounceDate != null),
      (l10n.cqStClear, day(c.clearingDate), cleared),
    ];
    final now = failed ? -1 : steps.indexWhere((s) => !s.$3);
    return ListView(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24), children: [
      HomeOverlap(
        overlap: 44,
        top: HomeListHero(
          title: title,
          subtitle: [if ((c.customer ?? '').isNotEmpty) c.customer!, if ((c.bank ?? '').isNotEmpty) c.bank!].join(' · '),
          back: true,
          bottom: Padding(
            padding: const EdgeInsets.only(bottom: 48),
            child: Wrap(spacing: 6, runSpacing: 6, children: [
              CatalogBadge.status(chequeStatusLabel(l10n, c.status), tone),
              if (dueNow) CatalogBadge.glass(l10n.chequeDueForDeposit),
            ]),
          ),
        ),
        bottom: Container(
          margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFEFE6D4)),
            boxShadow: const [BoxShadow(color: Color(0x290F1E33), blurRadius: 40, offset: Offset(0, 18))],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(l10n.chequeAmount, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
            Text.rich(
              key: const Key('cheque-amount'),
              TextSpan(children: [
                TextSpan(text: c.amount == null ? '—' : contractMoney(c.amount!.toDouble()), style: homeDisplay(28, colors.inkStrong)),
                TextSpan(text: ' $currency', style: TextStyle(fontSize: 13, color: colors.inkMuted)),
              ]),
            ),
            if (dueLine != null) Text(dueLine, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: dueNow ? colors.error : AppPalette.gold600)),
            const SizedBox(height: 14),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (final (i, (label, at, done)) in steps.indexed)
                Expanded(
                  child: Column(children: [
                    Container(
                      key: Key('cheque-step-$i'),
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: done ? catalogAvailable : (i == now ? AppPalette.gold400 : (failed && i == steps.length - 1 ? const Color(0xFFB3261E) : const Color(0xFFEFE8DC))),
                        boxShadow: i == now ? const [BoxShadow(color: Color(0xFFF6E9C9), spreadRadius: 4)] : null,
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
            if (c.status == 'BOUNCED' && (c.bounceReason?.trim().isNotEmpty ?? false)) ...[
              const SizedBox(height: 10),
              Text('${l10n.chequeBounceReason}: ${c.bounceReason}', style: TextStyle(fontSize: 12, color: colors.error)),
            ],
          ]),
        ),
      ),
      HomeSection(
        icon: Icons.receipt_long_rounded,
        title: l10n.pmCheque,
        child: KvTable(rows: [
          (l10n.chequeNumberLabel, ltr(c.number ?? '—')),
          (l10n.chequeBank, c.bank ?? '—'),
          (l10n.chequeDueDate, date(c.dueDate) ?? '—'),
          if (c.clearingDate != null) (l10n.chequeClearedOn, date(c.clearingDate)!),
          if (c.bounceDate != null) (l10n.chequeBouncedOn, date(c.bounceDate)!),
          if (c.replacedByNumber != null) (l10n.chequeReplacedBy, ltr('#${c.replacedByNumber}')),
          (l10n.chequeRecordedBy, c.recordedBy ?? '—'),
        ]),
      ),
      if (c.customer != null || c.contractNumber != null || c.reservationNumber != null)
        HomeSection(
          icon: Icons.person_rounded,
          title: l10n.chequeCustomer,
          child: Column(children: [
            KvTable(rows: [
              if (c.customer != null) (l10n.chequeCustomer, c.customer!),
              if (c.contractNumber != null) (l10n.chequeContract, ltr(c.contractNumber!)),
              if (c.reservationNumber != null) (l10n.chequeReservation, ltr(c.reservationNumber!)),
            ]),
            if (c.contractId != null) ...[
              const SizedBox(height: 8),
              ReservationLinkCard(key: const Key('cheque-open-contract'), icon: Icons.description_rounded, title: l10n.rbOpenContract, onTap: () => context.push('/contracts/${c.contractId}')),
            ] else if (c.reservationId != null) ...[
              const SizedBox(height: 8),
              ReservationLinkCard(key: const Key('cheque-open-reservation'), icon: Icons.bookmark_rounded, title: l10n.chequeReservation, onTap: () => context.push('/reservations/${c.reservationId}')),
            ],
          ]),
        ),
      if (c.payments.isNotEmpty)
        HomeSection(
          icon: Icons.payments_rounded,
          title: l10n.cqCovers,
          child: KvTable(rows: [
            for (final p in c.payments) (p.installmentDue == null ? l10n.chequePayments : '${l10n.chequeInstallmentDue} ${date(p.installmentDue)}', chequeMoney(p.amount, lang)),
          ]),
        ),
      Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 18, AppSpacing.lg, 0),
        child: Text(l10n.chequeOnDashboard, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
      ),
    ]);
  }
}

Future<void> _confirmDeposit(BuildContext context) async {
  final l10n = context.l10n;
  final cubit = context.read<ChequeDetailCubit>();
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(l10n.chequeDepositTitle),
      content: Text(l10n.chequeDepositHint),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(l10n.actionCancel)),
        FilledButton(
          key: const Key('cheque-deposit-confirm'),
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(l10n.chequeConfirm),
        ),
      ],
    ),
  );
  if (ok == true) await cubit.deposit();
}

Future<void> _confirmClear(BuildContext context) async {
  final l10n = context.l10n;
  final cubit = context.read<ChequeDetailCubit>();
  final lang = Localizations.localeOf(context).languageCode;
  final today = DateUtils.dateOnly(DateTime.now());
  var date = today;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        title: Text(l10n.chequeClearTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.chequeClearHint),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton.icon(
              key: const Key('cheque-clear-date'),
              icon: const Icon(Icons.event_rounded, size: 18),
              label: Text('${l10n.chequeClearDate}: ${followUpDate(date, lang)}'),
              onPressed: () async {
                final picked = await showDatePicker(
                  context: ctx,
                  initialDate: date,
                  firstDate: today.subtract(const Duration(days: 365)),
                  lastDate: today,
                );
                if (picked != null) setState(() => date = picked);
              },
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(l10n.actionCancel)),
          FilledButton(
            key: const Key('cheque-clear-confirm'),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.chequeConfirm),
          ),
        ],
      ),
    ),
  );
  if (ok == true) await cubit.clear(clearingDate: date);
}

