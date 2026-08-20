import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/staff_deposit.dart';
import '../cubit/deposits_cubit.dart';

class DepositsScreen extends StatefulWidget {
  const DepositsScreen({super.key, this.contractId});
  final String? contractId;

  @override
  State<DepositsScreen> createState() => _DepositsScreenState();
}

class _DepositsScreenState extends State<DepositsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<DepositsCubit>().load(contractId: widget.contractId);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<DepositsCubit>();
    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.navDeposits,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          Expanded(
            child: BlocBuilder<DepositsCubit, DepositsListState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const StaffListSkeleton();
            case DataStatus.failure:
              return ErrorState(failure: state.failure, onRetry: () => cubit.load());
            case DataStatus.empty:
              return EmptyState(
                icon: Icons.receipt_long_outlined,
                title: l10n.depositsEmptyTitle,
                message: l10n.depositsEmptyMessage,
              );
            case DataStatus.success:
              return RefreshIndicator(
                onRefresh: () => cubit.load(contractId: widget.contractId),
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: state.deposits.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) => _DepositTile(state.deposits[i]),
                ),
              );
          }
        },
      ),
          ),
        ],
      ),
    );
  }
}

class _DepositTile extends StatelessWidget {
  const _DepositTile(this.deposit);
  final StaffDeposit deposit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;

    final tone = deposit.verified
        ? BadgeTone.success
        : deposit.reviewStatus == DepositReviewStatus.rejected
            ? BadgeTone.error
            : BadgeTone.warning;

    final label = deposit.verified
        ? l10n.depositVerified
        : l10n.depositPending;

    return AppCard(
      elevation: AppCardElevation.soft,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        deposit.customerName ?? '—',
                        style: Theme.of(context).textTheme.titleSmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    StatusBadge(label: label, tone: tone),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    if (deposit.contractNumber != null) '#${deposit.contractNumber}',
                    if (deposit.unitCode != null) deposit.unitCode!,
                    if (deposit.type != null) _typeLabel(l10n, deposit.type!),
                  ].join('  ·  '),
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: colors.inkMuted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (deposit.amount != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    PriceFormatter.format(deposit.amount, languageCode: lang),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colors.brandGold,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ],
              ],
            ),
          ),
          if (deposit.paidAt != null) ...[
            const SizedBox(width: AppSpacing.sm),
            Text(
              _fmtDate(deposit.paidAt!),
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: colors.inkMuted),
            ),
          ],
        ],
      ),
    );
  }

  String _typeLabel(dynamic l10n, String type) => switch (type) {
        'DOWN_PAYMENT' => l10n.depositTypeDownPayment as String,
        'INSTALLMENT' => l10n.depositTypeInstallment as String,
        'FINAL_PAYMENT' => l10n.depositTypeFinal as String,
        'BOOKING' => l10n.depositTypeBooking as String,
        _ => type,
      };

  String _fmtDate(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}';
}
