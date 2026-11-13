import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/contract_statement.dart';
import '../domain/repositories/contracts_repository.dart';
import 'contract_money.dart';

/// «كشف الحساب» — every charge and payment on one of the customer's own
/// contracts, with the balance after each, and what is late, due today and
/// still to come. Same figures as the contract page on the dashboard.
class ContractStatementScreen extends StatefulWidget {
  const ContractStatementScreen({super.key, required this.contractId, this.contractNumber});

  final String contractId;
  final String? contractNumber;

  @override
  State<ContractStatementScreen> createState() => _ContractStatementScreenState();
}

class _ContractStatementScreenState extends State<ContractStatementScreen> {
  Result<ContractStatement>? _result;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _result = null);
    final r = await context.read<ContractsRepository>().getStatement(widget.contractId);
    if (mounted) setState(() => _result = r);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final r = _result;
    return Scaffold(
      backgroundColor: colors.canvas,
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.statementTitle,
            subtitle: widget.contractNumber != null ? ltr(widget.contractNumber!) : null,
            compact: true,
            leadingAction: const NavHeaderBack(),
          ),
          Expanded(
            child: switch (r) {
              null => const KitDetailSkeleton(heroHeight: 0, facts: 5),
              Err(:final failure) => ErrorState(failure: failure, onRetry: _load),
              Ok(:final data) => RefreshIndicator(onRefresh: _load, child: _StatementBody(statement: data)),
            },
          ),
        ],
      ),
    );
  }
}

class _StatementBody extends StatelessWidget {
  const _StatementBody({required this.statement});
  final ContractStatement statement;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final s = statement;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);
    final chips = <(IconData, Color, String, double)>[
      if (s.overdue > 0) (Icons.warning_rounded, colors.error, l10n.installmentStatusOverdue, s.overdue),
      if (s.dueToday > 0) (Icons.today_rounded, colors.warning, l10n.statementDueToday, s.dueToday),
      if (s.upcoming > 0) (Icons.schedule_rounded, colors.info, l10n.statementUpcoming, s.upcoming),
      if (s.awaiting > 0) (Icons.hourglass_top_rounded, AppPalette.gold500, l10n.statementAwaiting, s.awaiting),
    ];
    // Movements by month, newest month first, each month in date order.
    final months = <DateTime, List<StatementLine>>{};
    for (final line in s.lines) {
      months.putIfAbsent(DateTime(line.date.year, line.date.month), () => []).add(line);
    }
    final keys = months.keys.toList()..sort((a, b) => b.compareTo(a));
    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.xl + MediaQuery.of(context).padding.bottom,
      ),
      children: [
        ContractMoneyCard(statement: s, showAsOf: true),
        if (chips.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final (icon, tone, label, value) in chips)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: tone.withValues(alpha: 0.09),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: tone.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon, size: 16, color: tone),
                      const SizedBox(width: 6),
                      Text(label, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
                      const SizedBox(width: 8),
                      Text(money(value), style: theme.textTheme.bodyMedium?.copyWith(color: tone, fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
            ],
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        SectionTitle(l10n.statementMovements),
        for (final m in keys) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            DateFormatter.monthYear(m, languageCode: lang),
            style: theme.textTheme.labelLarge?.copyWith(color: colors.inkMuted, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.xs),
          Container(
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
            ),
            child: Column(
              children: [
                for (var k = 0; k < months[m]!.length; k++) ...[
                  if (k > 0) Divider(height: 1, indent: AppSpacing.md, endIndent: AppSpacing.md, color: colors.hairline),
                  _LineRow(line: months[m]![k]),
                ],
              ],
            ),
          ),
        ],
        if (s.awaitingCount > 0) ...[
          const SizedBox(height: AppSpacing.md),
          Text(l10n.statementAwaitingNote, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
        ],
      ],
    );
  }
}

class _LineRow extends StatelessWidget {
  const _LineRow({required this.line});
  final StatementLine line;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);

    final isCredit = line.credit > 0;
    final amount = isCredit ? line.credit : line.debit;
    final (IconData icon, Color tone) = switch (line.kind) {
      'PAYMENT' => (Icons.south_west_rounded, colors.success),
      'REVERSAL' => (Icons.undo_rounded, colors.error),
      'WAIVER' => (Icons.money_off_rounded, colors.inkMuted),
      'FEE' => (Icons.receipt_long_rounded, colors.warning),
      _ => (Icons.description_outlined, AppPalette.gold500),
    };
    final note = [
      DateFormatter.mediumDate(line.date, languageCode: lang),
      if (line.rowDueDate != null && line.kind != 'CONTRACT')
        l10n.statementDueOn(DateFormatter.mediumDate(line.rowDueDate!, languageCode: lang)),
      if (line.unrecorded) l10n.statementMarkedPaid,
      if (line.reason != null && line.reason!.isNotEmpty) l10n.statementReason(line.reason!),
    ].join(' · ');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(color: tone.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(11)),
            child: Icon(icon, size: 19, color: tone),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  statementLineLabel(l10n, line),
                  style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(note, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                money(amount),
                style: theme.textTheme.bodyMedium?.copyWith(color: isCredit ? colors.success : colors.inkStrong, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 2),
              Text(
                l10n.statementBalanceAfter(money(line.balance)),
                style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// What a statement line is, in words: «سداد قسط نقدًا», «عكس سداد الدفعة المقدمة», …
String statementLineLabel(AppLocalizations l10n, StatementLine l) {
  final what = switch (l.rowType) {
    'BOOKING' || 'RESERVATION' => l10n.depositTypeBooking,
    'DOWN_PAYMENT' => l10n.depositTypeDownPayment,
    'FINAL_PAYMENT' => l10n.depositTypeFinal,
    'BOUNCE_PENALTY' => l10n.planTypeBouncePenalty,
    'LATE_FEE' => l10n.planTypeLateFee,
    'TRANSFER_FEE' => l10n.planTypeTransferFee,
    _ => l10n.depositTypeInstallment,
  };
  final how = switch (l.method) {
    'CASH' => l10n.paymentMethodCash,
    'BANK_TRANSFER' => l10n.paymentMethodBankTransfer,
    'CHEQUE' => l10n.paymentMethodCheque,
    null => null,
    _ => l10n.paymentMethodOther,
  };
  return switch (l.kind) {
    'CONTRACT' => l10n.statementContractValue,
    'FEE' => what,
    'WAIVER' => l10n.statementWaiverOf(what),
    'REVERSAL' => l10n.statementReversalOf(what),
    _ => how != null ? l10n.statementPaymentOfBy(what, how) : l10n.statementPaymentOf(what),
  };
}
