import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/catalog_status_label.dart';
import '../../domain/entities/broker_project.dart';
import '../cubit/broker_units_cubit.dart';

/// Broker project detail: header + the project's units (read-only). Tapping a
/// unit opens its detail; the project context is carried for lead creation.
class BrokerProjectDetailScreen extends StatefulWidget {
  const BrokerProjectDetailScreen({super.key, required this.project});
  final BrokerProject project;

  @override
  State<BrokerProjectDetailScreen> createState() => _BrokerProjectDetailScreenState();
}

class _BrokerProjectDetailScreenState extends State<BrokerProjectDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerUnitsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final p = widget.project;

    return Scaffold(
      appBar: AppBar(title: Text(p.name.resolve(lang))),
      body: RefreshIndicator(
        onRefresh: () => context.read<BrokerUnitsCubit>().load(),
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            AppCard(
              elevation: AppCardElevation.soft,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(p.name.resolve(lang), style: Theme.of(context).textTheme.titleLarge)),
                      StatusBadge(label: projectStatusLabel(l10n, p.status), tone: projectStatusTone(p.status)),
                    ],
                  ),
                  if (p.city != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(p.city!, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted)),
                  ],
                  if (p.commissionPct != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text('${l10n.brokerCommissionPct}: ${p.commissionPct}%',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
                  ],
                  const SizedBox(height: AppSpacing.md),
                  AppButton(
                    label: l10n.brokerLeadNew,
                    icon: Icons.person_add_alt_1_outlined,
                    variant: AppButtonVariant.outline,
                    size: AppButtonSize.medium,
                    onPressed: () => context.push('/broker/leads/new', extra: {'projectId': p.id}),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(l10n.navUnits, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            _Units(projectId: p.id),
          ],
        ),
      ),
    );
  }
}

class _Units extends StatelessWidget {
  const _Units({required this.projectId});
  final String projectId;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return BlocBuilder<BrokerUnitsCubit, BrokerUnitsState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return const Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: Center(child: CircularProgressIndicator()),
            );
          case DataStatus.failure:
            return ErrorState(failure: state.failure, onRetry: () => context.read<BrokerUnitsCubit>().load());
          case DataStatus.empty:
            return Text(l10n.unitsEmptyMessage,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted));
          case DataStatus.success:
            return Column(
              children: [
                for (final unit in state.data!) ...[
                  AppCard(
                    onTap: () => context.push('/broker/units/${unit.id}',
                        extra: {'unit': unit, 'projectId': projectId}),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(unit.code, style: Theme.of(context).textTheme.titleSmall),
                              if (unit.type != null) ...[
                                const SizedBox(height: 2),
                                Text(unit.type!,
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
                              ],
                            ],
                          ),
                        ),
                        StatusBadge(label: unitStatusLabel(l10n, unit.status), tone: unitStatusTone(unit.status)),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
              ],
            );
        }
      },
    );
  }
}
