import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/lead.dart';
import '../cubit/leads_cubit.dart';

/// Leads list with search, stage filter chips, and a "my leads" toggle.
class LeadsScreen extends StatefulWidget {
  const LeadsScreen({super.key});

  @override
  State<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends State<LeadsScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<LeadsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<LeadsCubit>();

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.navLeads),
        actions: [
          BlocBuilder<LeadsCubit, LeadsListState>(
            buildWhen: (a, b) => a.mine != b.mine,
            builder: (context, state) => IconButton(
              tooltip: l10n.leadsMine,
              isSelected: state.mine,
              icon: const Icon(Icons.person_outline_rounded),
              selectedIcon: const Icon(Icons.person_rounded),
              onPressed: cubit.toggleMine,
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 0),
            child: TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: l10n.leadsSearchHint,
                prefixIcon: const Icon(Icons.search_rounded),
                isDense: true,
              ),
              onSubmitted: cubit.setSearch,
            ),
          ),
          _StageFilter(),
          Expanded(
            child: BlocBuilder<LeadsCubit, LeadsListState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.people_outline_rounded,
                      title: l10n.leadsEmptyTitle,
                      message: l10n.leadsEmptyMessage,
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        itemCount: state.leads.length,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) => _LeadTile(lead: state.leads[i]),
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

class _StageFilter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<LeadsCubit>();
    return SizedBox(
      height: 48,
      child: BlocBuilder<LeadsCubit, LeadsListState>(
        buildWhen: (a, b) => a.stage != b.stage,
        builder: (context, state) => ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
              child: ChoiceChip(
                label: Text(l10n.leadsFilterAll),
                selected: state.stage == null,
                onSelected: (_) => cubit.setStage(null),
              ),
            ),
            for (final stage in kLeadStages)
              Padding(
                padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
                child: ChoiceChip(
                  label: Text(leadStageLabel(l10n, stage)),
                  selected: state.stage == stage,
                  onSelected: (_) => cubit.setStage(stage),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _LeadTile extends StatelessWidget {
  const _LeadTile({required this.lead});
  final Lead lead;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return AppCard(
      onTap: () => context.push('/leads/${lead.id}', extra: lead),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(lead.fullName, style: Theme.of(context).textTheme.titleSmall),
                if (lead.projectInterest != null) ...[
                  const SizedBox(height: 2),
                  Text(lead.projectInterest!,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: colors.inkMuted)),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          StatusBadge(label: leadStageLabel(l10n, lead.stage), tone: leadStageTone(lead.stage)),
        ],
      ),
    );
  }
}
