import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/catalog_status_label.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_project_detail_cubit.dart';

/// Staff project detail (read-only): header + the project's units.
class StaffProjectDetailScreen extends StatefulWidget {
  const StaffProjectDetailScreen({super.key, this.fallback});
  final StaffProject? fallback;

  @override
  State<StaffProjectDetailScreen> createState() => _StaffProjectDetailScreenState();
}

class _StaffProjectDetailScreenState extends State<StaffProjectDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<StaffProjectDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final title = widget.fallback?.name.resolve(lang) ?? context.l10n.navProjects;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: BlocBuilder<StaffProjectDetailCubit, StaffProjectDetailState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<StaffProjectDetailCubit>().load(),
              );
            case DataStatus.empty:
            case DataStatus.success:
              return _Body(detail: state.data!);
          }
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.detail});
  final StaffProjectDetail detail;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final p = detail.project;
    final description = detail.description?.resolve(lang);

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        AppCard(
          elevation: AppCardElevation.soft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(p.name.resolve(lang),
                        style: Theme.of(context).textTheme.titleLarge),
                  ),
                  StatusBadge(
                    label: projectStatusLabel(l10n, p.status),
                    tone: projectStatusTone(p.status),
                  ),
                ],
              ),
              if (p.city != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(p.city!,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted)),
              ],
              if (description != null && description.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(description, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(l10n.navUnits, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        if (detail.units.isEmpty)
          Text(l10n.unitsEmptyMessage,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted))
        else
          for (final unit in detail.units) ...[
            AppCard(
              onTap: () => context.push('/units/${unit.id}', extra: {'projectId': p.id}),
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
                  const SizedBox(width: AppSpacing.sm),
                  StatusBadge(label: unitStatusLabel(l10n, unit.status), tone: unitStatusTone(unit.status)),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
      ],
    );
  }
}
