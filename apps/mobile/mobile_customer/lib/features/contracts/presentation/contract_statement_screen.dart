import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/contract_statement.dart';
import '../domain/repositories/contracts_repository.dart';

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
              null => const Center(child: CircularProgressIndicator()),
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

    final figures = <(IconData, Color, String, double)>[
      (Icons.check_circle_rounded, colors.success, l10n.statementPaid, s.paid),
      if (s.overdue > 0) (Icons.warning_rounded, colors.error, l10n.installmentStatusOverdue, s.overdue),
      if (s.dueToday > 0) (Icons.today_rounded, colors.warning, l10n.statementDueToday, s.dueToday),
      if (s.upcoming > 0) (Icons.schedule_rounded, colors.inkMuted, l10n.statementUpcoming, s.upcoming),
      if (s.awaiting > 0) (Icons.hourglass_top_rounded, AppPalette.gold400, l10n.statementAwaiting, s.awaiting),
    ];

    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.xl + MediaQuery.of(context).padding.bottom,
      ),
      children: [
        // ── Balance
        Container(
          key: const Key('statement-balance'),
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF243F62), Color(0xFF0B1726)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadii.xl),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.statementBalance,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: AlignmentDirectional.centerStart,
                child: Text(
                  money(s.balance),
                  style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900, height: 1.1),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                l10n.statementAsOf(DateFormatter.mediumDate(s.asOf, languageCode: lang)),
                style: const TextStyle(color: AppPalette.gold300, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // ── Figures
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: AppSpacing.sm,
          crossAxisSpacing: AppSpacing.sm,
          childAspectRatio: 2.4,
          children: [
            for (final f in figures) AppKpiTile(icon: f.$1, iconColor: f.$2, label: f.$3, value: money(f.$4)),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),

        // ── Movements
        AppSectionHeader(title: l10n.statementMovements),
        const SizedBox(height: AppSpacing.sm),
        for (final line in s.lines) ...[
          _LineCard(line: line),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (s.awaitingCount > 0) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.statementAwaitingNote,
            style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
          ),
        ],
      ],
    );
  }
}

class _LineCard extends StatelessWidget {
  const _LineCard({required this.line});
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
    final tone = switch (line.kind) {
      'PAYMENT' => colors.success,
      'REVERSAL' => colors.error,
      'WAIVER' => colors.inkMuted,
      _ => colors.inkStrong,
    };
    final note = [
      if (line.rowDueDate != null && line.kind != 'CONTRACT')
        l10n.statementDueOn(DateFormatter.mediumDate(line.rowDueDate!, languageCode: lang)),
      if (line.unrecorded) l10n.statementMarkedPaid,
      if (line.reason != null && line.reason!.isNotEmpty) l10n.statementReason(line.reason!),
    ].join(' · ');

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  statementLineLabel(l10n, line),
                  style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  DateFormatter.mediumDate(line.date, languageCode: lang),
                  style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                ),
                if (note.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(note, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                money(amount),
                style: theme.textTheme.bodyMedium?.copyWith(color: tone, fontWeight: FontWeight.w800),
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
