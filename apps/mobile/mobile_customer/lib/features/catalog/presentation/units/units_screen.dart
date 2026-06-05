import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/unit.dart';
import '../compare/compare_cubit.dart';
import '../compare/compare_selection_bar.dart';
import '../widgets/catalog_controls.dart';
import '../widgets/catalog_skeletons.dart';
import '../widgets/unit_card.dart';
import 'units_cubit.dart';
import 'units_filters_sheet.dart';
import 'units_state.dart';

class UnitsScreen extends StatefulWidget {
  const UnitsScreen({super.key});

  @override
  State<UnitsScreen> createState() => _UnitsScreenState();
}

class _UnitsScreenState extends State<UnitsScreen> {
  final _scroll = ScrollController();
  late final TextEditingController _search;

  @override
  void initState() {
    super.initState();
    _search = TextEditingController();
    _scroll.addListener(() {
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 400) {
        context.read<UnitsCubit>().loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _openFilters() async {
    final cubit = context.read<UnitsCubit>();
    final result = await showUnitsFilterSheet(context, current: cubit.state.filter);
    if (result != null) cubit.applyFilter(result);
  }

  /// Resets the applied (backend) filters from an empty state.
  Widget _clearFiltersButton(BuildContext context, AppLocalizations l10n) =>
      AppButton(
        label: l10n.clearFilters,
        icon: Icons.tune_rounded,
        variant: AppButtonVariant.outline,
        size: AppButtonSize.small,
        onPressed: () =>
            context.read<UnitsCubit>().applyFilter(const UnitsFilter()),
      );

  /// Clears the local text search from an empty state.
  Widget _clearSearchButton(BuildContext context, AppLocalizations l10n) =>
      AppButton(
        label: l10n.clearFilters,
        icon: Icons.close_rounded,
        variant: AppButtonVariant.outline,
        size: AppButtonSize.small,
        onPressed: () {
          _search.clear();
          setState(() {});
        },
      );

  /// Local, in-memory search over the currently-loaded units (the public units
  /// API exposes no text query). Matches code, type, project name (ar/en),
  /// city, and floor — works for Arabic and English.
  List<Unit> _applyQuery(List<Unit> items) {
    final q = _search.text.trim().toLowerCase();
    if (q.isEmpty) return items;
    return items.where((u) {
      final hay = [
        u.code,
        u.type,
        u.project?.name.resolve('ar') ?? '',
        u.project?.name.resolve('en') ?? '',
        u.project?.city ?? '',
        u.floor?.toString() ?? '',
      ].join(' ').toLowerCase();
      return hay.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // Drive the sticky compare dock + reserved list padding off the shared
    // selection. `watch` rebuilds the screen as units are (de)selected.
    final compareCount = context.watch<CompareCubit>().state.length;
    // Compare-selection entry (from the Compare tab CTA) shows a gentle hint.
    final compareMode =
        GoRouterState.of(context).uri.queryParameters['compare'] == 'true';

    return Scaffold(
      appBar: AdaptiveAppBar(title: Text(l10n.unitsTitle)),
      body: Stack(
        children: [
          Column(
            children: [
              // Premium search + filter control area (matches /projects).
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.sm),
                child: Row(
                  children: [
                    Expanded(
                      child: CatalogSearchField(
                        controller: _search,
                        hint: l10n.unitsSearchHint,
                        onChanged: (_) => setState(() {}),
                        onSubmitted: (_) => setState(() {}),
                        onClear: () {
                          _search.clear();
                          setState(() {});
                        },
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    BlocBuilder<UnitsCubit, UnitsState>(
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
              // Optional guidance when the user arrived in compare-selection mode.
              if (compareMode && compareCount == 0)
                _SelectionHint(text: l10n.compareSelectionHint),
              Expanded(
                child: BlocBuilder<UnitsCubit, UnitsState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const UnitsGridSkeleton();
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => context.read<UnitsCubit>().load(),
                    );
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.search_off_rounded,
                      title: l10n.noUnitsTitle,
                      message: l10n.noUnitsMessage,
                      action: state.filter.activeCount > 0
                          ? _clearFiltersButton(context, l10n)
                          : null,
                    );
                  case DataStatus.success:
                    final visible = _applyQuery(state.items);
                    if (visible.isEmpty) {
                      // Query matched nothing in the loaded set (local search),
                      // or the applied filters excluded everything.
                      final searching = _search.text.trim().isNotEmpty;
                      return EmptyState(
                        icon: Icons.search_off_rounded,
                        title: l10n.noUnitsTitle,
                        message: l10n.noUnitsMessage,
                        action: searching
                            ? _clearSearchButton(context, l10n)
                            : (state.filter.activeCount > 0
                                ? _clearFiltersButton(context, l10n)
                                : null),
                      );
                    }
                    final searching = _search.text.trim().isNotEmpty;
                    return RefreshIndicator(
                      onRefresh: () => context.read<UnitsCubit>().refresh(),
                      child: ListView.separated(
                        controller: _scroll,
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.lg,
                          AppSpacing.lg,
                          AppSpacing.lg +
                              MediaQuery.of(context).padding.bottom +
                              // Reserve room for the sticky compare dock so the
                              // last card is never hidden behind it.
                              (compareCount > 0
                                  ? (context.isApplePlatform ? 144 : 96)
                                  : 0),
                        ),
                        // Load-more spinner only when not locally filtering.
                        itemCount: visible.length +
                            (!searching && state.isLoadingMore ? 1 : 0),
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.lg),
                        itemBuilder: (context, i) {
                          if (i >= visible.length) {
                            return const Center(
                              child: Padding(
                                padding: EdgeInsets.all(AppSpacing.md),
                                child: CircularProgressIndicator(),
                              ),
                            );
                          }
                          final unit = visible[i];
                          return UnitCard(
                            unit: unit,
                            onTap: () => context.push('/units/${unit.id}'),
                          );
                        },
                      ),
                    );
                }
              },
                ),
              ),
            ],
          ),
          // Sticky compare dock — only visible when units are selected.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: CompareSelectionBar(
              onCompare: () => context.go('/compare'),
            ),
          ),
        ],
      ),
    );
  }
}

/// A subtle one-line hint shown under the search when the Units tab is opened
/// in compare-selection mode (from the Compare tab CTA).
class _SelectionHint extends StatelessWidget {
  const _SelectionHint({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.sm),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: colors.brandGoldSoft,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: colors.brandGold.withValues(alpha: 0.25)),
        ),
        child: Row(
          children: [
            Icon(Icons.compare_arrows_rounded,
                size: 16, color: colors.brandGold),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                text,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
