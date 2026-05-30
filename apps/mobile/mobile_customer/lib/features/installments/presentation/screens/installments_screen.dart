import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../cubit/installments_cubit.dart';
import '../widgets/installment_card.dart';

/// Lists the customer's installment schedule. Mirrors the deposits screen
/// shape — 5-status switch with RefreshIndicator + Skeletonizer (via
/// AppCard) — so the two surfaces feel related.
class InstallmentsScreen extends StatefulWidget {
  const InstallmentsScreen({super.key});

  @override
  State<InstallmentsScreen> createState() => _InstallmentsScreenState();
}

class _InstallmentsScreenState extends State<InstallmentsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<InstallmentsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.installmentsTitle)),
      body: BlocBuilder<InstallmentsCubit, InstallmentsState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<InstallmentsCubit>().load(),
              );
            case DataStatus.empty:
              return EmptyState(
                icon: Icons.event_repeat_outlined,
                title: l10n.installmentsEmptyTitle,
                message: l10n.installmentsEmptyMessage,
              );
            case DataStatus.success:
              final rows = state.data!;
              return RefreshIndicator(
                onRefresh: () => context.read<InstallmentsCubit>().load(),
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: rows.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) => InstallmentCard(installment: rows[i]),
                ),
              );
          }
        },
      ),
    );
  }
}
