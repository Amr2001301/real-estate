import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../catalog/domain/entities/project.dart';
import '../../../catalog/domain/repositories/catalog_repository.dart';
import '../../../catalog/presentation/widgets/project_content.dart';

/// «تقدم إنشاءات مشاريعك» in «عقاري»: one row per project the customer owns
/// a unit in that lists construction stages — its overall completion on a
/// bar, and a tap opens the stages on the project page. Nothing while it
/// loads, on an error, or when no project lists stages.
class OwnedProjectsProgress extends StatefulWidget {
  const OwnedProjectsProgress({super.key, required this.projectIds});

  final List<String> projectIds;

  @override
  State<OwnedProjectsProgress> createState() => _OwnedProjectsProgressState();
}

class _OwnedProjectsProgressState extends State<OwnedProjectsProgress> {
  List<ProjectDetail> _projects = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(OwnedProjectsProgress old) {
    super.didUpdateWidget(old);
    if (old.projectIds.join(',') != widget.projectIds.join(',')) _load();
  }

  Future<void> _load() async {
    final ids = widget.projectIds;
    if (ids.isEmpty) return;
    final repo = context.read<CatalogRepository>();
    final results = await Future.wait(ids.map(repo.getProject));
    if (!mounted) return;
    setState(() {
      _projects = [
        for (final r in results)
          if (r case Ok<ProjectDetail>(:final data) when data.progress != null) data,
      ];
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_projects.isEmpty) return const SizedBox.shrink();
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      key: const Key('owned-projects-progress'),
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(color: colors.brandGold.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)),
              child: Icon(Icons.engineering_rounded, size: 20, color: colors.brandGold),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: Text(l10n.myPropertyProgressTitle, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800))),
          ]),
          for (final p in _projects) ...[
            const SizedBox(height: AppSpacing.md),
            InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => context.push('/projects/${p.id}?section=progress'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: [
                    Expanded(child: Text(p.name.resolve(lang), style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700, color: colors.inkStrong))),
                    ProgressStatusChip(complete: p.progress!.isComplete),
                  ]),
                  const SizedBox(height: AppSpacing.xs),
                  Row(children: [
                    Expanded(
                      child: ProgressBar(
                        percent: p.progress!.overall,
                        color: p.progress!.isComplete ? colors.success : colors.brandGold,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text('${p.progress!.overall}%', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  ]),
                  const SizedBox(height: 4),
                  Row(children: [
                    Expanded(
                      child: Text(
                        p.progress!.updatedAt != null
                            ? l10n.projectProgressUpdatedAt(DateFormatter.mediumDate(p.progress!.updatedAt!.toLocal(), languageCode: lang))
                            : '',
                        style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                      ),
                    ),
                    Text(l10n.myPropertyProgressViewStages, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: colors.brandGold)),
                    Icon(Icons.chevron_right_rounded, size: 18, color: colors.brandGold),
                  ]),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
