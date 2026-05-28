import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../../common/visit_status_label.dart';
import '../../domain/entities/visit.dart';
import '../cubit/visits_cubit.dart';

/// Visits (appointments) list with a "today" toggle and status filter chips.
class VisitsScreen extends StatefulWidget {
  const VisitsScreen({super.key});

  @override
  State<VisitsScreen> createState() => _VisitsScreenState();
}

class _VisitsScreenState extends State<VisitsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<VisitsCubit>().load();
  }

  Future<void> _create() async {
    final created = await context.push<bool>('/visits/new');
    if (created == true && mounted) context.read<VisitsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<VisitsCubit>();
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.navVisits),
        actions: [
          BlocBuilder<VisitsCubit, VisitsListState>(
            buildWhen: (a, b) => a.today != b.today,
            builder: (context, state) => IconButton(
              tooltip: l10n.visitsToday,
              isSelected: state.today,
              icon: const Icon(Icons.today_outlined),
              selectedIcon: const Icon(Icons.today_rounded),
              onPressed: cubit.toggleToday,
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add_rounded),
        label: Text(l10n.visitNew),
      ),
      body: Column(
        children: [
          _StatusFilter(),
          Expanded(
            child: BlocBuilder<VisitsCubit, VisitsListState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.event_busy_outlined,
                      title: l10n.visitsEmptyTitle,
                      message: l10n.visitsEmptyMessage,
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        itemCount: state.visits.length,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) => _VisitTile(visit: state.visits[i]),
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
    final cubit = context.read<VisitsCubit>();
    return SizedBox(
      height: 48,
      child: BlocBuilder<VisitsCubit, VisitsListState>(
        buildWhen: (a, b) => a.statusFilter != b.statusFilter,
        builder: (context, state) => ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
              child: ChoiceChip(
                label: Text(l10n.leadsFilterAll),
                selected: state.statusFilter == null,
                onSelected: (_) => cubit.setStatus(null),
              ),
            ),
            for (final s in kVisitStatuses)
              Padding(
                padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
                child: ChoiceChip(
                  label: Text(visitStatusLabel(l10n, s)),
                  selected: state.statusFilter == s,
                  onSelected: (_) => cubit.setStatus(s),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _VisitTile extends StatelessWidget {
  const _VisitTile({required this.visit});
  final Visit visit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return AppCard(
      onTap: () => context.push('/visits/${visit.id}', extra: visit),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(visit.clientName ?? visit.projectName ?? l10n.navVisits,
                    style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 2),
                Text(
                  [
                    if (visit.scheduledAt != null)
                      DateFormatter.shortDate(visit.scheduledAt!, languageCode: lang),
                    if (visit.unitCode != null) visit.unitCode!,
                  ].join(' · '),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          StatusBadge(label: visitStatusLabel(l10n, visit.status), tone: visitStatusTone(visit.status)),
        ],
      ),
    );
  }
}
