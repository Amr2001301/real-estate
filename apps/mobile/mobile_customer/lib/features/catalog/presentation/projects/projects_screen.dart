import 'package:core/core.dart';
import 'package:flutter/material.dart';
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
  final _scroll = ScrollController();
  late final TextEditingController _search;

  @override
  void initState() {
    super.initState();
    _search = TextEditingController(
      text: context.read<ProjectsCubit>().state.filter.query ?? '',
    );
    _scroll.addListener(_onScroll);
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
      appBar: AppBar(
        title: Text(l10n.projectsTitle),
        actions: [
          BlocBuilder<ProjectsCubit, ProjectsState>(
            buildWhen: (a, b) => a.filter != b.filter,
            builder: (context, state) => IconButton(
              tooltip: l10n.filtersTitle,
              icon: Badge(
                isLabelVisible: state.filter.activeCount > 0,
                label: Text('${state.filter.activeCount}'),
                child: const Icon(Icons.tune_rounded),
              ),
              onPressed: _openFilters,
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.xs),
            child: AppTextField(
              controller: _search,
              hint: l10n.projectsSearchHint,
              prefixIcon: Icons.search_rounded,
              textInputAction: TextInputAction.search,
              onChanged: (_) => setState(() {}),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () {
                        _search.clear();
                        context.read<ProjectsCubit>().search(null);
                        setState(() {});
                      },
                    ),
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
                    return EmptyState(
                      icon: Icons.search_off_rounded,
                      title: l10n.noProjectsTitle,
                      message: l10n.noProjectsMessage,
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
    return RefreshIndicator(
      onRefresh: () => context.read<ProjectsCubit>().refresh(),
      child: GridView.builder(
        controller: scroll,
        padding: const EdgeInsets.all(AppSpacing.lg),
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
          maxCrossAxisExtent: 360,
          mainAxisExtent: 280,
          crossAxisSpacing: AppSpacing.md,
          mainAxisSpacing: AppSpacing.md,
        ),
        itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
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
