import 'dart:math' as math;

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../widgets/catalog_controls.dart';
import '../widgets/catalog_skeletons.dart';
import '../widgets/project_card.dart';
import 'projects_cubit.dart';
import 'projects_filters_sheet.dart';
import 'projects_state.dart';

// ─── Shared palette for the navy header ──────────────────────────────────────
const Color _navyLight = Color(0xFF24426A);
const Color _navyMid = Color(0xFF14273F);
const Color _navyDeep = Color(0xFF0B1726);

class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  final _scroll = ScrollController();
  late final TextEditingController _search;

  late String _lastRouteQuery;

  @override
  void initState() {
    super.initState();
    final initial = context.read<ProjectsCubit>().state.filter.query ?? '';
    _search = TextEditingController(text: initial);
    _lastRouteQuery = initial;
    _scroll.addListener(_onScroll);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final routeQuery =
        GoRouterState.of(context).uri.queryParameters['q']?.trim() ?? '';
    if (routeQuery == _lastRouteQuery) return;
    _lastRouteQuery = routeQuery;
    _search.text = routeQuery;
    context
        .read<ProjectsCubit>()
        .search(routeQuery.isEmpty ? null : routeQuery);
  }

  void _onScroll() {
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 400) {
      context.read<ProjectsCubit>().loadMore();
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _openFilters() async {
    final cubit = context.read<ProjectsCubit>();
    final result = await showProjectsFilterSheet(
      context,
      current: cubit.state.filter,
      cities: cubit.state.knownCities,
    );
    if (result != null) cubit.applyFilter(result);
  }

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value:
          SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: RefreshIndicator(
          onRefresh: () => context.read<ProjectsCubit>().refresh(),
          child: BlocBuilder<ProjectsCubit, ProjectsState>(
            builder: (context, state) {
              final l10n = context.l10n;
              return CustomScrollView(
                controller: _scroll,
                slivers: [
                  // ── Immersive navy header (collapses to title-only bar) ───
                  SliverPersistentHeader(
                    pinned: true,
                    delegate: _ProjectsHeaderDelegate(
                      topInset: topInset,
                      searchController: _search,
                      onSearchSubmit: (q) {
                        final query = q.trim();
                        setState(() {});
                        context
                            .read<ProjectsCubit>()
                            .search(query.isEmpty ? null : query);
                      },
                      onSearchChange: (_) => setState(() {}),
                      onSearchClear: () {
                        _search.clear();
                        setState(() {});
                        context.read<ProjectsCubit>().search(null);
                      },
                      onFilter: _openFilters,
                      activeFilterCount: state.filter.activeCount,
                      itemCount: state.status == DataStatus.success
                          ? state.items.length
                          : null,
                    ),
                  ),

                  // ── Active filter chips (when filters are on) ─────────────
                  if (state.filter.activeCount > 0)
                    SliverToBoxAdapter(
                      child: _ActiveFilterBar(filter: state.filter),
                    ),

                  // ── Main content ──────────────────────────────────────────
                  ..._buildContent(context, state, l10n),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  List<Widget> _buildContent(
    BuildContext context,
    ProjectsState state,
    dynamic l10n,
  ) {
    switch (state.status) {
      case DataStatus.initial:
      case DataStatus.loading:
        return [const SliverFillRemaining(child: ProjectsGridSkeleton())];

      case DataStatus.failure:
        return [
          SliverFillRemaining(
            child: ErrorState(
              failure: state.failure,
              onRetry: () => context.read<ProjectsCubit>().load(),
            ),
          ),
        ];

      case DataStatus.empty:
        final filtering = state.filter.activeCount > 0 ||
            (state.filter.query?.isNotEmpty ?? false);
        return [
          SliverFillRemaining(
            child: EmptyState(
              icon: Icons.search_off_rounded,
              title: l10n.noProjectsTitle,
              message: l10n.noProjectsMessage,
              action: filtering
                  ? AppButton(
                      label: l10n.clearFilters,
                      icon: Icons.tune_rounded,
                      variant: AppButtonVariant.outline,
                      size: AppButtonSize.small,
                      onPressed: () {
                        _search.clear();
                        context
                            .read<ProjectsCubit>()
                            .applyFilter(const ProjectsFilter());
                      },
                    )
                  : null,
            ),
          ),
        ];

      case DataStatus.success:
        return [
          SliverPadding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg + MediaQuery.paddingOf(context).bottom,
            ),
            sliver: SliverList.separated(
              itemCount:
                  state.items.length + (state.isLoadingMore ? 1 : 0),
              separatorBuilder: (_, _) =>
                  const SizedBox(height: AppSpacing.lg),
              itemBuilder: (context, i) {
                if (i >= state.items.length) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(AppSpacing.md),
                      child: CircularProgressIndicator(),
                    ),
                  );
                }
                final project = state.items[i];
                return ProjectCard(
                  project: project,
                  index: i,
                  onTap: () => context.push('/projects/${project.id}'),
                )
                    .animate(
                      delay: Duration(
                          milliseconds: math.min(i * 70, 350)),
                    )
                    .fadeIn(duration: 380.ms)
                    .slideY(
                      begin: 0.05,
                      end: 0,
                      duration: 380.ms,
                      curve: Curves.easeOut,
                    );
              },
            ),
          ),
        ];
    }
  }
}

// ─── Immersive header delegate ────────────────────────────────────────────────

/// Collapsing navy gradient header.
///
/// Expanded (shrinkOffset = 0):
///   • Title row: canPop back button | screen title | count badge
///   • Search row: search field + filter button
///
/// Collapsed (shrinkOffset ≥ maxExtent − minExtent):
///   • Only the title row is visible (search row faded to 0)
class _ProjectsHeaderDelegate extends SliverPersistentHeaderDelegate {
  _ProjectsHeaderDelegate({
    required this.topInset,
    required this.searchController,
    required this.onSearchSubmit,
    required this.onSearchChange,
    required this.onSearchClear,
    required this.onFilter,
    required this.activeFilterCount,
    required this.itemCount,
  });

  final double topInset;
  final TextEditingController searchController;
  final ValueChanged<String> onSearchSubmit;
  final ValueChanged<String> onSearchChange;
  final VoidCallback onSearchClear;
  final VoidCallback onFilter;
  final int activeFilterCount;
  final int? itemCount;

  static const double _titleH = 56.0;
  static const double _searchH = 60.0;

  @override
  double get minExtent => topInset + _titleH;
  @override
  double get maxExtent => topInset + _titleH + _searchH;

  @override
  bool shouldRebuild(_ProjectsHeaderDelegate old) =>
      old.topInset != topInset ||
      old.activeFilterCount != activeFilterCount ||
      old.itemCount != itemCount;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    final collapseRange = maxExtent - minExtent;
    final t = collapseRange > 0
        ? (shrinkOffset / collapseRange).clamp(0.0, 1.0)
        : 1.0;

    // Search row fades out faster than the header collapses.
    final searchOpacity = (1.0 - t * 1.6).clamp(0.0, 1.0);
    final theme = Theme.of(context);
    final l10n = context.l10n;
    final canPop = Navigator.of(context).canPop();

    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_navyLight, _navyMid, _navyDeep],
          stops: [0.0, 0.48, 1.0],
        ),
      ),
      child: Stack(
        children: [
          // ── Title row ─────────────────────────────────────────────────────
          Positioned(
            top: topInset,
            left: 0,
            right: 0,
            height: _titleH,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Leading: back button (shown only when route can pop)
                  SizedBox(
                    width: 44,
                    child: canPop
                        ? _HeaderIconButton(
                            icon: Icons.arrow_back_ios_rounded,
                            onTap: () => Navigator.of(context).maybePop(),
                          )
                        : null,
                  ),
                  // Center: screen title
                  Expanded(
                    child: Center(
                      child: Text(
                        l10n.projectsTitle,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                  // Trailing: project count badge
                  SizedBox(
                    width: 44,
                    child: itemCount != null
                        ? Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: _CountBadge(count: itemCount!),
                          )
                        : null,
                  ),
                ],
              ),
            ),
          ),

          // ── Search row (fades out when collapsing) ─────────────────────
          if (searchOpacity > 0)
            Positioned(
              top: topInset + _titleH,
              left: 0,
              right: 0,
              height: _searchH,
              child: Opacity(
                opacity: searchOpacity,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    0,
                    AppSpacing.lg,
                    AppSpacing.sm,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: CatalogSearchField(
                          controller: searchController,
                          hint: l10n.projectsSearchHint,
                          onChanged: onSearchChange,
                          onSubmitted: onSearchSubmit,
                          onClear: onSearchClear,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      CatalogFilterButton(
                        activeCount: activeFilterCount,
                        tooltip: l10n.filtersTitle,
                        onTap: onFilter,
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // ── Bottom gold hairline accent ────────────────────────────────
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.0),
                    AppPalette.gold400.withValues(alpha: 0.45),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Small glass-tinted icon button for the header — back arrow, search, etc.
class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.10),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          width: 36,
          height: 36,
          child: Icon(icon, size: 18, color: Colors.white),
        ),
      ),
    );
  }
}

/// Small gold-outlined count pill that shows the total result count.
class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xs + 2,
        vertical: 3,
      ),
      decoration: BoxDecoration(
        color: AppPalette.gold400.withValues(alpha: 0.18),
        borderRadius: AppRadii.pillAll,
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.45),
          width: 0.8,
        ),
      ),
      child: Text(
        '$count',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: AppPalette.gold300,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

// ─── Active filter chips strip ────────────────────────────────────────────────

/// Horizontal scroll row of dismissible chips shown below the header when
/// any filter is active. Each chip labels the active criterion and tapping ×
/// removes only that criterion.
class _ActiveFilterBar extends StatelessWidget {
  const _ActiveFilterBar({required this.filter});
  final ProjectsFilter filter;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    final chips = <_FilterChipData>[
      if (filter.city != null)
        _FilterChipData(
          label: filter.city!,
          onRemove: () => context
              .read<ProjectsCubit>()
              .applyFilter(filter.copyWith(clearCity: true)),
        ),
      if (filter.featuredOnly)
        _FilterChipData(
          label: l10n.filterFeaturedOnly,
          onRemove: () => context
              .read<ProjectsCubit>()
              .applyFilter(filter.copyWith(featuredOnly: false)),
        ),
    ];

    if (chips.isEmpty) return const SizedBox.shrink();

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(
          bottom: BorderSide(color: colors.hairline, width: 0.5),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.xs,
        ),
        child: Row(
          children: [
            for (final chip in chips) ...[
              _ActiveFilterChip(data: chip),
              const SizedBox(width: AppSpacing.xs),
            ],
          ],
        ),
      ),
    );
  }
}

class _FilterChipData {
  const _FilterChipData({required this.label, required this.onRemove});
  final String label;
  final VoidCallback onRemove;
}

class _ActiveFilterChip extends StatelessWidget {
  const _ActiveFilterChip({required this.data});
  final _FilterChipData data;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.only(
        left: AppSpacing.sm,
        right: AppSpacing.xxs,
        top: 5,
        bottom: 5,
      ),
      decoration: BoxDecoration(
        color: AppPalette.gold400.withValues(alpha: 0.08),
        borderRadius: AppRadii.pillAll,
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.35),
          width: 0.8,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            data.label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: colors.brandGold,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 2),
          GestureDetector(
            onTap: data.onRemove,
            child: Padding(
              padding: const EdgeInsets.all(3),
              child:
                  Icon(Icons.close_rounded, size: 13, color: colors.brandGold),
            ),
          ),
        ],
      ),
    );
  }
}
