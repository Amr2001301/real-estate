import 'dart:math' as math;

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

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
  /// Display-only Arabic normalization for English city values from the data.
  String _cityLabel(String raw) => switch (raw) {
        'Riyadh' => 'الرياض',
        'Jeddah' => 'جدة',
        'New Damietta' => 'دمياط الجديدة',
        _ => raw,
      };

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
                  // ── The staff app's header: title, count, filter, search, cities ──
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.projectsTitle,
                      subtitle: state.status == DataStatus.success ? l10n.ctProjectsCountN(state.items.length) : null,
                      back: context.canPop(),
                      actions: [
                        HomeHeroButton(
                          key: const Key('projects-filter'),
                          icon: Icons.tune_rounded,
                          tooltip: l10n.filtersTitle,
                          active: state.filter.activeCount > 0,
                          onTap: _openFilters,
                        ),
                      ],
                      bottom: HomeSearchField(
                        controller: _search,
                        hint: l10n.projectsSearchHint,
                        onSubmitted: (q) {
                          final query = q.trim();
                          context.read<ProjectsCubit>().search(query.isEmpty ? null : query);
                        },
                        onClear: () {
                          _search.clear();
                          context.read<ProjectsCubit>().search(null);
                        },
                      ),
                    ),
                  ),
                  if (state.knownCities.length > 1)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 14),
                        child: HomePills(pills: [
                          HomePill(
                            id: 'all',
                            label: l10n.lvAll,
                            selected: state.filter.city == null,
                            onTap: () => context.read<ProjectsCubit>().applyFilter(state.filter.copyWith(clearCity: true)),
                          ),
                          for (final c in state.knownCities)
                            HomePill(
                              id: c,
                              label: _cityLabel(c),
                              selected: state.filter.city == c,
                              onTap: () => context.read<ProjectsCubit>().applyFilter(state.filter.copyWith(city: c)),
                            ),
                        ]),
                      ),
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
              AppSpacing.md,
              12,
              AppSpacing.md,
              MediaQuery.paddingOf(context).bottom + 110,
            ),
            sliver: SliverList.separated(
              itemCount:
                  state.items.length + (state.isLoadingMore ? 1 : 0),
              separatorBuilder: (_, _) => const SizedBox(height: 10),
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
