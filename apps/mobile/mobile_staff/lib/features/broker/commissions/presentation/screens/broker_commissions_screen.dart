import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../common/broker_status_label.dart';
import '../../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/broker_commission.dart';
import '../cubit/broker_commissions_cubit.dart';

/// Broker commissions (read-only): approved/pending totals + history + chips.
/// A 403 (no commissions-view permission) shows a friendly localized message.
class BrokerCommissionsScreen extends StatefulWidget {
  const BrokerCommissionsScreen({super.key});

  @override
  State<BrokerCommissionsScreen> createState() => _State();
}

class _State extends State<BrokerCommissionsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerCommissionsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerCommissionsCubit>();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.navCommissions)),
      body: BlocBuilder<BrokerCommissionsCubit, BrokerCommissionsState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const StaffListSkeleton();
            case DataStatus.failure:
              return ErrorState(failure: state.failure, onRetry: cubit.load);
            case DataStatus.empty:
            case DataStatus.success:
              return RefreshIndicator(
                onRefresh: cubit.load,
                child: ListView(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  children: [
                    _Overview(state: state),
                    const SizedBox(height: AppSpacing.lg),
                    _StatusChips(selected: state.statusFilter),
                    const SizedBox(height: AppSpacing.sm),
                    if (state.commissions.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.xxl),
                        child: EmptyState(
                          icon: Icons.payments_outlined,
                          title: l10n.brokerCommissionsEmptyTitle,
                          message: l10n.brokerCommissionsEmptyMessage,
                        ),
                      )
                    else
                      for (final c in state.commissions) ...[
                        _Tile(commission: c),
                        const SizedBox(height: AppSpacing.sm),
                      ],
                  ],
                ),
              );
          }
        },
      ),
    );
  }
}

class _Overview extends StatelessWidget {
  const _Overview({required this.state});
  final BrokerCommissionsState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);
    return AppCard(
      elevation: AppCardElevation.soft,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(money(state.approvedTotal),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(color: colors.success)),
                const SizedBox(height: 2),
                Text(l10n.bonusStatusApproved,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(money(state.pendingTotal),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(color: colors.warning)),
                const SizedBox(height: 2),
                Text(l10n.bonusStatusPending,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusChips extends StatelessWidget {
  const _StatusChips({this.selected});
  final String? selected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerCommissionsCubit>();
    return Wrap(
      spacing: AppSpacing.xs,
      children: [
        ChoiceChip(
          label: Text(l10n.leadsFilterAll),
          selected: selected == null,
          onSelected: (_) => cubit.setStatus(null),
        ),
        for (final s in kBrokerCommissionStatuses)
          ChoiceChip(
            label: Text(brokerCommissionStatusLabel(l10n, s)),
            selected: selected == s,
            onSelected: (_) => cubit.setStatus(s),
          ),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.commission});
  final BrokerCommission commission;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return AppCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  PriceFormatter.formatString(commission.netAmount ?? commission.grossAmount, languageCode: lang),
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                if (commission.projectName != null) ...[
                  const SizedBox(height: 2),
                  Text(commission.projectName!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          StatusBadge(
            label: brokerCommissionStatusLabel(l10n, commission.status),
            tone: brokerCommissionStatusTone(commission.status),
          ),
        ],
      ),
    );
  }
}
