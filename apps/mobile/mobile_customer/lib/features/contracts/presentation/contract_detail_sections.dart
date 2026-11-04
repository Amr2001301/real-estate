import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../installments/domain/entities/installment.dart';
import '../../installments/domain/repositories/installments_repository.dart';
import '../domain/entities/contract.dart';
import '../domain/entities/contract_statement.dart';
import '../domain/repositories/contracts_repository.dart';
import '../../content/presentation/content_cubit.dart';
import 'contract_money.dart';

/// The contract page's money: the summary from the statement of account and
/// the next installment still to pay. Both load on their own; while loading
/// or on failure they take no room (the statement link stays below).
class ContractMoneySection extends StatelessWidget {
  const ContractMoneySection({super.key, required this.contract});
  final Contract contract;

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (ctx) =>
              LoadCubit<ContractStatement>(() => ctx.read<ContractsRepository>().getStatement(contract.id))..load(),
        ),
        BlocProvider(
          create: (ctx) => LoadCubit<List<Installment>>(() async {
            final all = await ctx.read<InstallmentsRepository>().getMyInstallments();
            return all.map((list) => nextDueOf(list, contract.id));
          })
            ..load(),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BlocBuilder<LoadCubit<ContractStatement>, LoadState<ContractStatement>>(
            builder: (context, state) => state.data == null
                ? const SizedBox.shrink()
                : Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.md),
                    child: ContractMoneyCard(statement: state.data!),
                  ),
          ),
          BlocBuilder<LoadCubit<List<Installment>>, LoadState<List<Installment>>>(
            builder: (context, state) => state.status == DataStatus.success
                ? Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.md),
                    child: _NextInstallmentCard(next: state.data!.isEmpty ? null : state.data!.first),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

/// The contract's rows still to pay (not paid, not replaced by a reschedule),
/// earliest first.
List<Installment> nextDueOf(List<Installment> all, String contractId) {
  final open = all
      .where((i) =>
          i.contractId == contractId &&
          i.status != InstallmentStatus.paid &&
          i.status != InstallmentStatus.cancelled)
      .toList()
    ..sort((a, b) => a.dueDate.compareTo(b.dueDate));
  return open;
}

class _NextInstallmentCard extends StatelessWidget {
  const _NextInstallmentCard({required this.next});
  final Installment? next;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final i = next;
    final overdue = i != null && i.status == InstallmentStatus.overdue;
    final tone = overdue ? colors.error : AppPalette.gold500;
    return Container(
      key: const Key('contract-next'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: overdue ? colors.error.withValues(alpha: 0.5) : colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 14, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SectionTitle(
            l10n.contractNextInstallment,
            trailing: TextButton(
              onPressed: () => context.push('/account/installments'),
              child: Text(l10n.contractViewInstallments),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (i == null)
            Text(l10n.contractNoUpcoming, style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted))
          else ...[
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(color: tone.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                  child: Icon(overdue ? Icons.warning_amber_rounded : Icons.event_rounded, color: tone),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        PriceFormatter.formatString(i.amount, languageCode: lang),
                        style: theme.textTheme.titleLarge?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w900),
                      ),
                      Text(
                        overdue
                            ? l10n.contractNextOverdue(DateFormatter.mediumDate(i.dueDate, languageCode: lang))
                            : l10n.contractNextDue(DateFormatter.mediumDate(i.dueDate, languageCode: lang)),
                        style: theme.textTheme.bodySmall?.copyWith(color: overdue ? colors.error : colors.inkMuted, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (i.canSubmitProof) ...[
              const SizedBox(height: AppSpacing.md),
              AppButton(
                label: l10n.paymentProofSubmit,
                icon: Icons.upload_file_rounded,
                variant: AppButtonVariant.gold,
                onPressed: () => context.push('/account/installments/${i.id}/submit-proof', extra: i),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

String _frequencyLabel(AppLocalizations l10n, String f) => switch (f) {
      'QUARTERLY' => l10n.freqQuarterly,
      'SEMI_ANNUAL' || 'SEMIANNUAL' => l10n.freqSemiAnnual,
      'ANNUAL' || 'YEARLY' => l10n.freqAnnual,
      _ => l10n.freqMonthly,
    };

/// «خطة السداد» — the contract's price and down payment, and how the rest is
/// paid: each installment, how often, for how long, from when. A contract
/// without a plan says it is paid in full.
class ContractPlanCard extends StatelessWidget {
  const ContractPlanCard({super.key, required this.contract});
  final Contract contract;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final plan = contract.plan;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);
    final rows = <(IconData, String, String)>[
      if (contract.totalAmount != null) (Icons.sell_outlined, l10n.contractTotalAmount, money(contract.totalAmount!)),
      if (contract.downPayment != null && contract.downPayment! > 0)
        (Icons.account_balance_wallet_outlined, l10n.contractDownPayment, money(contract.downPayment!)),
      if (plan != null) ...[
        (Icons.payments_outlined, l10n.contractPlanEach,
            '${money(plan.monthlyAmount)} / ${_frequencyLabel(l10n, plan.frequency)}'),
        (Icons.timelapse_rounded, l10n.contractPlanDuration, l10n.monthsCount(plan.totalMonths)),
        if (plan.startsAt != null)
          (Icons.event_available_rounded, l10n.contractPlanStart, DateFormatter.mediumDate(plan.startsAt!, languageCode: lang)),
      ],
    ];
    if (rows.isEmpty) return const SizedBox.shrink();
    return Container(
      key: const Key('contract-plan'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 14, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SectionTitle(l10n.contractPlanTitle),
          const SizedBox(height: AppSpacing.sm),
          for (var k = 0; k < rows.length; k++) ...[
            if (k > 0) Divider(height: 1, color: colors.hairline),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm + 2),
              child: Row(
                children: [
                  Icon(rows[k].$1, size: 18, color: AppPalette.gold500),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(child: Text(rows[k].$2, style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted))),
                  Text(
                    rows[k].$3,
                    style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ),
          ],
          if (plan == null) ...[
            Divider(height: 1, color: colors.hairline),
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm + 2),
              child: Text(l10n.contractPlanCash, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
            ),
          ],
        ],
      ),
    );
  }
}
