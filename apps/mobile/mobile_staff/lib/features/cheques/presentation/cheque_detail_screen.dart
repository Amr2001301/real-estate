import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/staff_list_skeleton.dart';
import '../../contracts/view/contract_page_screen.dart' show KvTable;
import '../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../leads/presentation/follow_up_labels.dart';
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
            final title = number != null ? ltr(number) : l10n.chequesTitle;
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
                        ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.navy))
                        : Icon(c.canDeposit ? Icons.account_balance_rounded : Icons.task_alt_rounded, size: 19),
                    label: Text(c.canDeposit ? l10n.chequeActionDeposit : l10n.chequeActionClear),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(50),
                      backgroundColor: homeCta(context),
                      foregroundColor: homeOnCta(context),
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
      HomeListHero(
        title: title,
        back: true,
        badge: DvHeroBadge(
          chequeStatusLabel(l10n, c.status),
          tone: switch (c.status) {
            'CLEARED' => DvTone.ok,
            'BOUNCED' || 'REPLACED' || 'CANCELLED' => DvTone.bad,
            'PENDING_CLEARANCE' => DvTone.warn,
            _ => DvTone.neutral,
          },
        ),
        subtitle: [if ((c.customer ?? '').isNotEmpty) c.customer!, if ((c.bank ?? '').isNotEmpty) c.bank!].join(' · '),
        bottom: DvHeroFigure(
          label: l10n.chequeAmount,
          value: c.amount == null ? '—' : contractMoney(c.amount!.toDouble()),
          unit: currency,
          valueKey: const Key('cheque-amount'),
          badge: dueNow ? DvHeroBadge(l10n.chequeDueForDeposit, tone: DvTone.warn) : null,
          footer: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (dueLine != null) ...[
              Text(dueLine, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: dueNow ? const Color(0xFFF29AA2) : const Color(0xFFC9B27A))),
              const SizedBox(height: 14),
            ],
            DvHeroSteps(
              keyPrefix: 'cheque-step',
              steps: [
                for (final (i, (label, at, done)) in steps.indexed) (label, i == now ? l10n.pmNow : at, done, failed && i == steps.length - 1),
              ],
            ),
            if (c.status == 'BOUNCED' && (c.bounceReason?.trim().isNotEmpty ?? false)) ...[
              const SizedBox(height: 10),
              Text('${l10n.chequeBounceReason}: ${c.bounceReason}', style: const TextStyle(fontSize: 12, color: Color(0xFFF29AA2))),
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
      if (c.customer != null || c.contractNumber != null || c.reservationNumber != null || c.contractId != null)
        HomeSection(
          icon: Icons.person_rounded,
          title: l10n.chequeCustomer,
          child: DvInfoCard(rows: [
            if (c.customer != null) DvInfo(l10n.chequeCustomer, c.customer!),
            if (c.contractNumber != null)
              DvInfo(l10n.chequeContract, ltr(c.contractNumber!),
                  id: c.contractId == null ? null : 'cheque-open-contract', onTap: c.contractId == null ? null : () => context.push('/contracts/${c.contractId}')),
            if (c.contractNumber == null && c.contractId != null)
              DvInfo(l10n.chequeContract, l10n.rbOpenContract, id: 'cheque-open-contract', onTap: () => context.push('/contracts/${c.contractId}')),
            if (c.reservationNumber != null)
              DvInfo(l10n.chequeReservation, ltr(c.reservationNumber!),
                  id: c.contractId != null || c.reservationId == null ? null : 'cheque-open-reservation',
                  onTap: c.contractId != null || c.reservationId == null ? null : () => context.push('/reservations/${c.reservationId}')),
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

