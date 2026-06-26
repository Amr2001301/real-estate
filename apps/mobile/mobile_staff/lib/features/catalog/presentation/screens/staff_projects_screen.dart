import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/catalog_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_projects_cubit.dart';

const _kAllStatus = '';
const _kStatuses = ['PUBLISHED', 'DRAFT', 'ARCHIVED'];

class StaffProjectsScreen extends StatefulWidget {
  const StaffProjectsScreen({super.key});

  @override
  State<StaffProjectsScreen> createState() => _StaffProjectsScreenState();
}

class _StaffProjectsScreenState extends State<StaffProjectsScreen> {
  final _search = TextEditingController();
  String _statusFilter = _kAllStatus;

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
          AppNavHeader(
            title: l10n.navProjects,
            subtitle: l10n.projectsSubtitle,
          ),
          _SearchBar(
            controller: _search,
            hint: l10n.projectsSearchHint,
            onSubmitted: cubit.setSearch,
          ),
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

// ═══════════════════════════════════════════════════════════════════════════════
// Project card
// ═══════════════════════════════════════════════════════════════════════════════
class _ProjectCard extends StatelessWidget {
  const _ProjectCard({required this.project});
  final StaffProject project;

  bool get _hasMetrics =>
      project.availableUnitsCount != null ||
      project.totalUnitsCount != null ||
      project.startingPrice != null;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final name = project.name.resolve(lang);

    return AppCard(
      padding: EdgeInsets.zero,
      onTap: () => context.push('/projects/${project.id}', extra: project),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Cover image ──────────────────────────────────────────────────────
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: SizedBox(
              height: 168,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  AppNetworkImage(url: project.coverImageUrl),
                  // Bottom scrim only — lets the image breathe at the top
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.45),
                        ],
                        stops: const [0.5, 1.0],
                      ),
                    ),
                  ),
                  // Status badge — top trailing (end) corner
                  PositionedDirectional(
                    top: AppSpacing.sm,
                    end: AppSpacing.sm,
                    child: StatusBadge(
                      label: projectStatusLabel(l10n, project.status),
                      tone: projectStatusTone(project.status),
                      variant: BadgeVariant.solid,
                    ),
                  ),
                  // Project name + city rendered ON the image (bottom-start)
                  PositionedDirectional(
                    start: AppSpacing.md,
                    end: AppSpacing.md,
                    bottom: AppSpacing.sm,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            height: 1.2,
                            shadows: [
                              Shadow(
                                offset: Offset(0, 1),
                                blurRadius: 4,
                                color: Colors.black54,
                              ),
                            ],
                          ),
                        ),
                        if (project.city != null)
                          Row(
                            children: [
                              const Icon(
                                Icons.location_on_rounded,
                                size: 13,
                                color: Colors.white70,
                              ),
                              const SizedBox(width: 2),
                              Text(
                                project.city!,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: Colors.white70,
                                  fontWeight: FontWeight.w500,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                      ],
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
                // Metrics strip (available / total / price)
                if (_hasMetrics) ...[
                  _MetricsStrip(project: project, lang: lang),
                  const SizedBox(height: AppSpacing.sm),
                ],
                // Unit type pills
                if (project.unitTypes.isNotEmpty) ...[
                  _UnitTypeRow(types: project.unitTypes),
                  const SizedBox(height: AppSpacing.sm),
                ],
                // CTA — gold filled, full width
                SizedBox(
                  width: double.infinity,
                  child: AppButton(
                    label: l10n.viewUnits,
                    icon: Icons.grid_view_rounded,
                    variant: AppButtonVariant.gold,
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

// ═══════════════════════════════════════════════════════════════════════════════
// Metrics strip — 3-column grid: متاح | يبدأ من | إجمالي
// Numbers are large + bold; labels are small + muted.
// ═══════════════════════════════════════════════════════════════════════════════
class _MetricsStrip extends StatelessWidget {
  const _MetricsStrip({required this.project, required this.lang});
  final StaffProject project;
  final String lang;

  /// Compact price: 35000000 → "35م" / "35M"
  String _compactPrice(double price) {
    if (price >= 1e6) {
      final v = price / 1e6;
      final suffix = lang == 'ar' ? 'م' : 'M';
      if (v == v.truncateToDouble()) return '${v.toInt()}$suffix';
      return '${v.toStringAsFixed(1)}$suffix';
    }
    if (price >= 1e3) {
      final suffix = lang == 'ar' ? 'ك' : 'K';
      return '${(price / 1e3).toInt()}$suffix';
    }
    return price.toInt().toString();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    // Build ordered metric slots (priority: available > price > total > sold)
    final items = <_MetricSlot>[];
    if (project.availableUnitsCount != null) {
      items.add(_MetricSlot(
        value: '${project.availableUnitsCount}',
        label: l10n.projectAvailableLabel,
        valueColor: colors.success,
      ));
    }
    if (project.startingPrice != null) {
      items.add(_MetricSlot(
        value: _compactPrice(project.startingPrice!),
        label: l10n.projectStartingFrom,
        valueColor: colors.brandGold,
      ));
    }
    if (project.totalUnitsCount != null && items.length < 3) {
      items.add(_MetricSlot(
        value: '${project.totalUnitsCount}',
        label: l10n.projectTotalLabel,
        valueColor: colors.inkStrong,
      ));
    }
    if (project.soldUnitsCount != null &&
        (project.soldUnitsCount ?? 0) > 0 &&
        items.length < 3) {
      items.add(_MetricSlot(
        value: '${project.soldUnitsCount}',
        label: l10n.projectSoldLabel,
        valueColor: colors.brandGold,
      ));
    }
    if (items.isEmpty) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: colors.hairline),
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            for (var i = 0; i < items.length; i++) ...[
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: _MetricCell(slot: items[i]),
                ),
              ),
              if (i < items.length - 1)
                Container(width: 1, color: colors.hairline),
            ],
          ],
        ),
      ),
    );
  }
}

class _MetricSlot {
  const _MetricSlot({
    required this.value,
    required this.label,
    required this.valueColor,
  });
  final String value;
  final String label;
  final Color valueColor;
}

class _MetricCell extends StatelessWidget {
  const _MetricCell({required this.slot});
  final _MetricSlot slot;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          slot.value,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: slot.valueColor,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          slot.label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: colors.inkMuted,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Unit type chips row
// ═══════════════════════════════════════════════════════════════════════════════
class _UnitTypeRow extends StatelessWidget {
  const _UnitTypeRow({required this.types});
  final List<String> types;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: types.take(5).map((t) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
          decoration: BoxDecoration(
            color: colors.brandGoldSoft,
            borderRadius: BorderRadius.circular(AppRadii.pill),
            border: Border.all(
              color: colors.brandGold.withValues(alpha: 0.35),
            ),
          ),
          child: Text(
            t,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: colors.brandGold,
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Search bar
// ═══════════════════════════════════════════════════════════════════════════════
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
