import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../cubit/contracts_cubit.dart';
import '../widgets/contract_card.dart';

class ContractsScreen extends StatefulWidget {
  const ContractsScreen({super.key});

  @override
  State<ContractsScreen> createState() => _ContractsScreenState();
}

class _ContractsScreenState extends State<ContractsScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<ContractsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ContractsCubit>();

    return Scaffold(
      appBar: AppBar(title: Text(l10n.navContracts)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 0),
            child: SearchBar(
              controller: _search,
              hintText: l10n.leadsSearchHint,
              leading: const Icon(Icons.search_rounded),
              onChanged: cubit.setSearch,
              elevation: const WidgetStatePropertyAll(0),
            ),
          ),
          _StatusFilter(),
          Expanded(
            child: BlocBuilder<ContractsCubit, ContractsListState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.description_outlined,
                      title: l10n.contractsEmptyTitle,
                      message: l10n.contractsEmptyMessage,
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        itemCount: state.contracts.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) {
                          final contract = state.contracts[i];
                          return ContractCard(
                            contract: contract,
                            onTap: () => context.push(
                              '/contracts/${contract.id}',
                              extra: contract,
                            ),
                          );
                        },
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

class _StatusFilter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ContractsCubit>();
    return BlocBuilder<ContractsCubit, ContractsListState>(
      buildWhen: (a, b) => a.statusFilter != b.statusFilter,
      builder: (context, state) {
        final filters = [
          (null, l10n.leadsFilterAll),
          ('SIGNED', l10n.contractStatusSigned),
          ('DRAFT', l10n.contractStatusDraft),
        ];
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            children: filters.map((f) {
              final selected = state.statusFilter == f.$1;
              return Padding(
                padding: const EdgeInsets.only(right: AppSpacing.xs),
                child: FilterChip(
                  label: Text(f.$2),
                  selected: selected,
                  onSelected: (_) => cubit.setStatus(f.$1),
                ),
              );
            }).toList(),
          ),
        );
      },
    );
  }
}
