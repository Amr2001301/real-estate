import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/project.dart';
import '../projects/projects_cubit.dart';

/// «استكشف مشاريعنا» on a signed-in customer's home: their tab bar has no
/// catalog tabs, so this is how an owner gets back to the company's projects
/// and units — to buy again, compare, or book a visit.
class HomeExploreSection extends StatelessWidget {
  const HomeExploreSection({super.key, this.showHeader = true});

  /// The home dashboard draws its own section row above this.
  final bool showHeader;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final state = context.watch<ProjectsCubit>().state;
    final projects = state.items.take(8).toList();
    // Nothing to show (still loading, failed or no projects): the three
    // shortcuts still lead to the lists.
    return Column(
      key: const Key('home-explore'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showHeader)
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.homeExploreTitle,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              InkWell(
                key: const Key('home-explore-all'),
                onTap: () => context.push('/explore/projects'),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 4,
                    vertical: 12,
                  ),
                  child: Text(
                    '${l10n.homeExploreAll} ›',
                    style: TextStyle(
                      color: colors.brandGold,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
            ],
          ),
        if (projects.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          SizedBox(
            height: 196,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: projects.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (_, i) => _ProjectTile(project: projects[i]),
            ),
          ),
        ] else if (state.status == DataStatus.loading ||
            state.status == DataStatus.initial)
          const SizedBox(
            height: 196,
            child: Center(child: CircularProgressIndicator.adaptive()),
          ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: _Shortcut(
                key: const Key('home-explore-units'),
                icon: Icons.grid_view_rounded,
                label: l10n.navUnits,
                onTap: () => context.push('/explore/units'),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _Shortcut(
                key: const Key('home-explore-compare'),
                icon: Icons.compare_arrows_rounded,
                label: l10n.navCompare,
                onTap: () => context.push('/explore/compare'),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _Shortcut(
                key: const Key('home-explore-visit'),
                icon: Icons.event_available_rounded,
                label: l10n.visitRequestTitle,
                onTap: projects.isEmpty
                    ? () => context.push('/explore/projects')
                    : () => _pickProjectForVisit(context, projects),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// A visit is booked for a project: choose which, then the usual form.
Future<void> _pickProjectForVisit(
  BuildContext context,
  List<ProjectListItem> projects,
) async {
  final lang = Localizations.localeOf(context).languageCode;
  final picked = await showModalBottomSheet<ProjectListItem>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    builder: (sheet) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(
              sheet.l10n.explorePickProject,
              style: Theme.of(
                sheet,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final p in projects)
                  ListTile(
                    key: Key('visit-pick-${p.id}'),
                    title: Text(p.name.resolve(lang)),
                    subtitle: p.city.trim().isEmpty ? null : Text(p.city),
                    trailing: const Icon(Icons.chevron_left_rounded),
                    onTap: () => Navigator.of(sheet).pop(p),
                  ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
  if (picked == null || !context.mounted) return;
  context.push(
    '/visit-request',
    extra: {
      'projectId': picked.id,
      'title': picked.name.resolve(lang),
      'subtitle': picked.city,
      'imageUrl': picked.coverImage,
    },
  );
}

class _ProjectTile extends StatelessWidget {
  const _ProjectTile({required this.project});
  final ProjectListItem project;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final city = project.city.trim();
    return SizedBox(
      width: 230,
      child: Material(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          key: Key('home-explore-project-${project.id}'),
          onTap: () => context.push('/projects/${project.id}'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CatalogCover(
                url: project.coverImage,
                height: 116,
                child: const SizedBox.shrink(),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      project.name.resolve(lang),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      [
                        if (city.isNotEmpty) city,
                        context.l10n.availableUnitsCount(
                          project.availableUnitsCount,
                        ),
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: colors.inkMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Shortcut extends StatelessWidget {
  const _Shortcut({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colors.hairline),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 20, color: colors.brandGold),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
