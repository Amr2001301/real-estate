import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/catalog_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_projects_cubit.dart';

// Status filter values for local client-side filtering (no cubit change).
const _kAllStatus = '';
const _kStatuses = ['PUBLISHED', 'DRAFT', 'ARCHIVED'];

/// Staff projects list — premium real-estate catalog view with local filtering.
class StaffProjectsScreen extends StatefulWidget {
  const StaffProjectsScreen({super.key});

  @override
  State<StaffProjectsScreen> createState() => _StaffProjectsScreenState();
}

class _StaffProjectsScreenState extends State<StaffProjectsScreen> {
  final _search = TextEditingController();
  String _statusFilter = _kAllStatus; // local client-side filter only

  @override
  void initState() {
    super.initState();
    context.read<StaffProjectsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<StaffProject> _filtered(List<StaffProject> all) {
    if (_statusFilter.isEmpty) return all;
    return all.where((p) => p.status == _statusFilter).toList();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<StaffProjectsCubit>();
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      body: Column(
        children: [
          // ── Premium header ──────────────────────────────────────────────────
          // No action needed for the projects screen — AppNavHeader's title-only
          // layout is clean without any disconnected actions row.
          AppNavHeader(
            title: l10n.navProjects,
            subtitle: l10n.projectsSubtitle,
          ),
          // ── Search ──────────────────────────────────────────────────────────
          _SearchBar(
            controller: _search,
            hint: l10n.projectsSearchHint,
            onSubmitted: cubit.setSearch,
          ),
          // ── Status filter pills (client-side) ───────────────────────────────
          AppFilterPills<String>(
            allLabel: l10n.leadsFilterAll,
            selected: _statusFilter.isEmpty ? null : _statusFilter,
            onSelected: (v) => setState(() => _statusFilter = v ?? _kAllStatus),
            options: _kStatuses
                .map(
                  (s) => FilterPillOption(
                    value: s,
                    label: projectStatusLabel(l10n, s),
                    tone: projectStatusTone(s),
                  ),
                )
                .toList(),
          ),
          // ── List ─────────────────────────────────────────────────────────────
          Expanded(
            child: BlocBuilder<StaffProjectsCubit, StaffProjectsState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: cubit.load,
                    );
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.apartment_outlined,
                      title: l10n.projectsEmptyTitle,
                      message: l10n.projectsEmptyMessage,
                    );
                  case DataStatus.success:
                    final visible = _filtered(state.projects);
                    if (visible.isEmpty) {
                      return EmptyState(
                        icon: Icons.apartment_outlined,
                        title: l10n.projectsEmptyTitle,
                        message: l10n.projectsEmptyMessage,
                      );
                    }
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          AppSpacing.xs,
                          AppSpacing.md,
                          bottomPad + 80,
                        ),
                        itemCount: visible.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.md),
                        itemBuilder: (context, i) =>
                            _ProjectCard(project: visible[i]),
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

// ── Project card ──────────────────────────────────────────────────────────────
// Premium real-estate card with:
//   • Top image area (cover photo or branded placeholder)
//   • Status badge overlaid on the image corner
//   • Project name + city below
//   • "عرض الوحدات" CTA button
//
// Fields NOT available from the current API (gracefully omitted):
//   • Available / total unit counts  (not in StaffProject entity or DTO)
//   • Starting price                  (not in StaffProject entity or DTO)
class _ProjectCard extends StatelessWidget {
  const _ProjectCard({required this.project});
  final StaffProject project;

  static const _imageHeight = 160.0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final name = project.name.resolve(lang);

    return AppCard(
      padding: EdgeInsets.zero,
      onTap: () => context.push('/projects/${project.id}', extra: project),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Image / placeholder ──────────────────────────────────────────────
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: SizedBox(
              height: _imageHeight,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  AppNetworkImage(url: project.coverImageUrl),
                  // Gradient scrim for text legibility if image is present
                  if (project.coverImageUrl != null)
                    DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.35),
                          ],
                          stops: const [0.5, 1.0],
                        ),
                      ),
                    ),
                  // Status badge — top trailing corner
                  PositionedDirectional(
                    top: AppSpacing.sm,
                    end: AppSpacing.sm,
                    child: StatusBadge(
                      label: projectStatusLabel(l10n, project.status),
                      tone: projectStatusTone(project.status),
                      variant: BadgeVariant.solid,
                    ),
                  ),
                ],
              ),
            ),
          ),
          // ── Card body ────────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.md,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: colors.inkStrong,
                    height: 1.25,
                  ),
                ),
                if (project.city != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        Icons.location_on_outlined,
                        size: 14,
                        color: colors.inkMuted,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        project.city!,
                        style: TextStyle(
                          fontSize: 13,
                          color: colors.inkMuted,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                // ── CTA button ─────────────────────────────────────────────────
                SizedBox(
                  width: double.infinity,
                  child: AppButton(
                    label: l10n.viewUnits,
                    icon: Icons.grid_view_rounded,
                    variant: AppButtonVariant.outline,
                    size: AppButtonSize.small,
                    onPressed: () =>
                        context.push('/projects/${project.id}', extra: project),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Search bar ────────────────────────────────────────────────────────────────
class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.controller,
    required this.hint,
    required this.onSubmitted,
  });
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onSubmitted;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.xs,
      ),
      child: TextField(
        controller: controller,
        textInputAction: TextInputAction.search,
        onSubmitted: onSubmitted,
        style: TextStyle(fontSize: 15, color: colors.inkStrong),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(fontSize: 15, color: colors.inkMuted),
          prefixIcon: Icon(
            Icons.search_rounded,
            size: 20,
            color: colors.inkMuted,
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 12,
          ),
          isDense: true,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            borderSide: BorderSide(color: colors.hairline),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            borderSide: BorderSide(color: colors.hairline),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            borderSide: BorderSide(color: colors.brandGold, width: 1.5),
          ),
          filled: true,
          fillColor: colors.surface,
        ),
      ),
    );
  }
}
