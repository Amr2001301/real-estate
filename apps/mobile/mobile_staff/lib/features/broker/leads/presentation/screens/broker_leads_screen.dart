import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/broker_status_label.dart';
import '../../../../../common/lead_stage_label.dart';
import '../../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/broker_lead.dart';
import '../cubit/broker_leads_cubit.dart';

/// Broker leads list with approval-status filter chips + search + create FAB.
class BrokerLeadsScreen extends StatefulWidget {
  const BrokerLeadsScreen({super.key});

  @override
  State<BrokerLeadsScreen> createState() => _BrokerLeadsScreenState();
}

class _BrokerLeadsScreenState extends State<BrokerLeadsScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<BrokerLeadsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final created = await context.push<bool>('/broker/leads/new');
    if (created == true && mounted) context.read<BrokerLeadsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerLeadsCubit>();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.navLeads)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add_rounded),
        label: Text(l10n.brokerLeadNew),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 0),
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
          _StatusFilter(),
          Expanded(
            child: BlocBuilder<BrokerLeadsCubit, BrokerLeadsListState>(
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
                      message: l10n.brokerLeadsEmptyMessage,
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

class _StatusFilter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerLeadsCubit>();
    return SizedBox(
      height: 48,
      child: BlocBuilder<BrokerLeadsCubit, BrokerLeadsListState>(
        buildWhen: (a, b) => a.approvalStatus != b.approvalStatus,
        builder: (context, state) => ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
              child: ChoiceChip(
                label: Text(l10n.leadsFilterAll),
                selected: state.approvalStatus == null,
                onSelected: (_) => cubit.setApprovalStatus(null),
              ),
            ),
            for (final s in kBrokerLeadStatuses)
              Padding(
                padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
                child: ChoiceChip(
                  label: Text(brokerLeadStatusLabel(l10n, s)),
                  selected: state.approvalStatus == s,
                  onSelected: (_) => cubit.setApprovalStatus(s),
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
  final BrokerLead lead;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return AppCard(
      onTap: () => context.push('/broker/leads/${lead.id}', extra: lead),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(lead.fullName, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 2),
                Text(
                  [
                    leadStageLabel(l10n, lead.stage),
                    if (lead.projectName != null) lead.projectName!,
                  ].join(' · '),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          StatusBadge(
            label: brokerLeadStatusLabel(l10n, lead.approvalStatus),
            tone: brokerLeadStatusTone(lead.approvalStatus),
          ),
        ],
      ),
    );
  }
}
