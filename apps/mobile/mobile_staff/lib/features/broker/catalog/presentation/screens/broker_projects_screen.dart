import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/catalog_status_label.dart';
import '../../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/broker_project.dart';
import '../cubit/broker_projects_cubit.dart';

/// Broker projects list (access-scoped, read-only).
class BrokerProjectsScreen extends StatefulWidget {
  const BrokerProjectsScreen({super.key});

  @override
  State<BrokerProjectsScreen> createState() => _BrokerProjectsScreenState();
}

class _BrokerProjectsScreenState extends State<BrokerProjectsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerProjectsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerProjectsCubit>();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.navProjects)),
      body: BlocBuilder<BrokerProjectsCubit, BrokerProjectsState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const StaffListSkeleton();
            case DataStatus.failure:
              return ErrorState(failure: state.failure, onRetry: cubit.load);
            case DataStatus.empty:
              return EmptyState(
                icon: Icons.apartment_outlined,
                title: l10n.projectsEmptyTitle,
                message: l10n.brokerProjectsEmptyMessage,
              );
            case DataStatus.success:
              return RefreshIndicator(
                onRefresh: cubit.load,
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: state.data!.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) => _ProjectTile(project: state.data![i]),
                ),
              );
          }
        },
      ),
    );
  }
}

class _ProjectTile extends StatelessWidget {
  const _ProjectTile({required this.project});
  final BrokerProject project;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return AppCard(
      onTap: () => context.push('/broker/projects/${project.id}', extra: project),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(project.name.resolve(lang), style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 2),
                Text(
                  [
                    if (project.city != null) project.city!,
                    if (project.commissionPct != null) '${l10n.brokerCommissionPct}: ${project.commissionPct}%',
                  ].join(' · '),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          StatusBadge(label: projectStatusLabel(l10n, project.status), tone: projectStatusTone(project.status)),
        ],
      ),
    );
  }
}
