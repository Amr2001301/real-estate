import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../widgets/catalog_controls.dart';
import '../widgets/catalog_skeletons.dart';
import '../widgets/project_card.dart';
import 'projects_cubit.dart';
import 'projects_filters_sheet.dart';
import 'projects_state.dart';

class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  final _scroll = ScrollController();
  late final TextEditingController _search;

  // The last `?q=` we applied from the route. The route builder seeds the cubit
  // on first build; on later visits the shell reuses this branch page (a
  // query-only `go` doesn't rebuild the route), so we re-sync in
  // didChangeDependencies — guarded by this so manual in-screen searches and
  // unrelated dependency changes (e.g. a language toggle) never clobber it.
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
    // React to a fresh `?q=` arriving from elsewhere (e.g. the Home search,
    // which switches to this tab via context.go).
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
    final l10n = context.l10n;
    return Scaffold(
      appBar: AdaptiveAppBar(title: Text(l10n.projectsTitle)),
      body: Column(
        children: [
          // Premium search + filter control area (filter moved out of the bar).
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.sm),
            child: Row(
              children: [
                Expanded(
                  child: CatalogSearchField(
                    controller: _search,
                    hint: l10n.projectsSearchHint,
                    onChanged: (_) => setState(() {}),
                    onSubmitted: (q) {
                      final query = q.trim();
                      context.read<ProjectsCubit>().search(query.isEmpty ? null : query);
                    },
                    onClear: () {
                      _search.clear();
                      context.read<ProjectsCubit>().search(null);
                      setState(() {});
                    },
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                BlocBuilder<ProjectsCubit, ProjectsState>(
                  buildWhen: (a, b) => a.filter != b.filter,
                  builder: (context, state) => CatalogFilterButton(
                    activeCount: state.filter.activeCount,
                    tooltip: l10n.filtersTitle,
                    onTap: _openFilters,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: BlocBuilder<ProjectsCubit, ProjectsState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const ProjectsGridSkeleton();
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => context.read<ProjectsCubit>().load(),
                    );
                  case DataStatus.empty:
                    final filtering = state.filter.activeCount > 0 ||
                        (state.filter.query?.isNotEmpty ?? false);
                    return EmptyState(
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
                    );
                  case DataStatus.success:
                    return _ProjectsGrid(state: state, scroll: _scroll);
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ProjectsGrid extends StatelessWidget {
  const _ProjectsGrid({required this.state, required this.scroll});
  final ProjectsState state;
  final ScrollController scroll;

  @override
  Widget build(BuildContext context) {
    // Single-column list of full-width premium cards — intrinsic height, so no
    // fixed-cell vertical overflow and ample room for website-parity data.
    return RefreshIndicator(
      onRefresh: () => context.read<ProjectsCubit>().refresh(),
      child: ListView.separated(
        controller: scroll,
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg + MediaQuery.of(context).padding.bottom,
        ),
        itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
        itemBuilder: (context, i) {
          if (i >= state.items.length) {
            return const Center(child: Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: CircularProgressIndicator(),
            ));
          }
          final project = state.items[i];
          return ProjectCard(
            project: project,
            onTap: () => context.push('/projects/${project.id}'),
          );
        },
      ),
    );
  }
}
