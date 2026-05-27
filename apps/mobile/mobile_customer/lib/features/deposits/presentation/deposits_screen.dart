import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/entities/deposit.dart';
import 'deposit_format.dart';
import 'deposits_cubit.dart';

/// Lists the customer's payments (deposits) with amount, type, date, and a
/// verified/pending status chip. Tapping one opens its receipt documents.
class DepositsScreen extends StatefulWidget {
  const DepositsScreen({super.key});

  @override
  State<DepositsScreen> createState() => _DepositsScreenState();
}

class _DepositsScreenState extends State<DepositsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<DepositsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.accountDeposits)),
      body: BlocBuilder<DepositsCubit, DepositsState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<DepositsCubit>().load(),
              );
            case DataStatus.empty:
              return EmptyState(
                icon: Icons.account_balance_wallet_outlined,
                title: l10n.depositsEmptyTitle,
                message: l10n.depositsEmptyMessage,
              );
            case DataStatus.success:
              final deposits = state.data!;
              return RefreshIndicator(
                onRefresh: () => context.read<DepositsCubit>().load(),
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: deposits.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) => _DepositTile(deposit: deposits[i]),
                ),
              );
          }
        },
      ),
    );
  }
}

class _DepositTile extends StatelessWidget {
  const _DepositTile({required this.deposit});

  final Deposit deposit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    return AppCard(
      onTap: () => context.push('/account/deposits/${deposit.id}', extra: deposit),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  PriceFormatter.formatString(deposit.amount, languageCode: lang),
                  style: theme.textTheme.titleMedium,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              StatusBadge(
                label: deposit.verified
                    ? l10n.depositVerified
                    : l10n.depositPending,
                tone: deposit.verified ? BadgeTone.success : BadgeTone.warning,
                dot: true,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: Text(
                  depositTypeLabel(l10n, deposit.type),
                  style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted),
                ),
              ),
              if (deposit.paidAt != null)
                Text(
                  DateFormatter.shortDate(deposit.paidAt!, languageCode: lang),
                  style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
