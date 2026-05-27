import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/entities/contract.dart';
import 'contracts_cubit.dart';

/// Lists the customer's contracts. Tapping one opens its detail (with the
/// signed PDF documents).
class ContractsScreen extends StatefulWidget {
  const ContractsScreen({super.key});

  @override
  State<ContractsScreen> createState() => _ContractsScreenState();
}

class _ContractsScreenState extends State<ContractsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ContractsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.accountContracts)),
      body: BlocBuilder<ContractsCubit, ContractsState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<ContractsCubit>().load(),
              );
            case DataStatus.empty:
              return EmptyState(
                icon: Icons.folder_outlined,
                title: l10n.contractsEmptyTitle,
                message: l10n.contractsEmptyMessage,
              );
            case DataStatus.success:
              final contracts = state.data!;
              return RefreshIndicator(
                onRefresh: () => context.read<ContractsCubit>().load(),
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: contracts.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) => _ContractTile(contract: contracts[i]),
                ),
              );
          }
        },
      ),
    );
  }
}

class _ContractTile extends StatelessWidget {
  const _ContractTile({required this.contract});

  final Contract contract;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final signed = contract.status == ContractStatus.signed;

    return AppCard(
      onTap: () => context.push('/account/contracts/${contract.id}', extra: contract),
      child: Row(
        children: [
          Icon(Icons.description_outlined, color: colors.brandGold),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  contract.contractNumber ?? contract.projectName.resolve(lang),
                  style: theme.textTheme.titleSmall,
                ),
                const SizedBox(height: 2),
                Text(
                  '${contract.unitType} · ${contract.unitCode}',
                  style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          StatusBadge(
            label: signed ? l10n.contractStatusSigned : l10n.contractStatusDraft,
            tone: signed ? BadgeTone.success : BadgeTone.neutral,
          ),
        ],
      ),
    );
  }
}
