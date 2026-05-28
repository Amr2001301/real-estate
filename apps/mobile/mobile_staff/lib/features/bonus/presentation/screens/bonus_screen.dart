import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../common/bonus_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/bonus_entry.dart';
import '../cubit/bonus_cubit.dart';

const _bonusStatuses = ['PENDING', 'APPROVED', 'PAID'];

/// Bonus / commission overview + history with paid/pending totals and chips.
class BonusScreen extends StatefulWidget {
  const BonusScreen({super.key});

  @override
  State<BonusScreen> createState() => _BonusScreenState();
}

class _BonusScreenState extends State<BonusScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BonusCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BonusCubit>();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.bonusTitle)),
      body: BlocBuilder<BonusCubit, BonusState>(
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
                    _OverviewCard(state: state),
                    const SizedBox(height: AppSpacing.lg),
                    _StatusChips(selected: state.statusFilter),
                    const SizedBox(height: AppSpacing.sm),
                    if (state.entries.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.xxl),
                        child: EmptyState(
                          icon: Icons.payments_outlined,
                          title: l10n.bonusEmptyTitle,
                          message: l10n.bonusEmptyMessage,
                        ),
                      )
                    else
                      for (final e in state.entries) ...[
                        _BonusTile(entry: e),
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

class _OverviewCard extends StatelessWidget {
  const _OverviewCard({required this.state});
  final BonusState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);
    return AppCard(
      elevation: AppCardElevation.soft,
      child: Row(
        children: [
          Expanded(
            child: _Metric(
              label: l10n.bonusPaid,
              value: money(state.overview.paidTotal),
              tone: BadgeTone.success,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: _Metric(
              label: l10n.bonusPending,
              value: money(state.overview.pendingTotal),
              tone: BadgeTone.warning,
            ),
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value, required this.tone});
  final String label;
  final String value;
  final BadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final accent = tone == BadgeTone.success ? colors.success : colors.warning;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: Theme.of(context).textTheme.titleLarge?.copyWith(color: accent)),
        const SizedBox(height: 2),
        Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
      ],
    );
  }
}

class _StatusChips extends StatelessWidget {
  const _StatusChips({this.selected});
  final String? selected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BonusCubit>();
    return Wrap(
      spacing: AppSpacing.xs,
      children: [
        ChoiceChip(
          label: Text(l10n.leadsFilterAll),
          selected: selected == null,
          onSelected: (_) => cubit.setStatus(null),
        ),
        for (final s in _bonusStatuses)
          ChoiceChip(
            label: Text(bonusStatusLabel(l10n, s)),
            selected: selected == s,
            onSelected: (_) => cubit.setStatus(s),
          ),
      ],
    );
  }
}

class _BonusTile extends StatelessWidget {
  const _BonusTile({required this.entry});
  final BonusEntry entry;

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
                  PriceFormatter.formatString(entry.amount, languageCode: lang),
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 2),
                Text(
                  [entry.period, if (entry.ruleName != null) entry.ruleName!].join(' · '),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          StatusBadge(label: bonusStatusLabel(l10n, entry.status), tone: bonusStatusTone(entry.status)),
        ],
      ),
    );
  }
}
