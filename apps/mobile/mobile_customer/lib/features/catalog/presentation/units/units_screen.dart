import 'dart:math' as math;

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/unit.dart';
import '../compare/compare_cubit.dart';
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
    _scroll.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 400) {
      context.read<UnitsCubit>().loadMore();
    }
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

  /// Local in-memory search over the currently-loaded units. Matches code,
  /// type, project name (ar/en), city, and floor.
  List<Unit> _applyQuery(List<Unit> items) {
    final q = _search.text.trim().toLowerCase();
    if (q.isEmpty) return items;
    return items.where((u) {
      final hay = [
        u.code,
        u.type,
        u.typeLabel('ar'),
        u.typeLabel('en'),
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
    final compareCount = context.watch<CompareCubit>().state.length;
    final compareMode =
        GoRouterState.of(context).uri.queryParameters['compare'] == 'true';

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light
          .copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocBuilder<UnitsCubit, UnitsState>(
          builder: (context, state) {
            final l10n = context.l10n;
            final searching = _search.text.trim().isNotEmpty;

            return RefreshIndicator(
              onRefresh: () => context.read<UnitsCubit>().refresh(),
              child: CustomScrollView(
                controller: _scroll,
                slivers: [
                  // ── The staff app's header: title, count, filter, search, status ──
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.unitsTitle,
                      subtitle: state.status == DataStatus.success ? l10n.ctUnitsCountN(_applyQuery(state.items).length) : null,
                      back: context.canPop(),
                      actions: [
                        HomeHeroButton(
                          key: const Key('units-filter'),
                          icon: Icons.tune_rounded,
                          tooltip: l10n.filtersTitle,
                          active: state.filter.activeCount > 0,
                          onTap: _openFilters,
                        ),
                      ],
                      bottom: HomeSearchField(
                        controller: _search,
                        hint: l10n.unitsSearchHint,
                        onSubmitted: (_) => setState(() {}),
                        onClear: () {
                          _search.clear();
                          setState(() {});
                        },
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 14),
                      child: HomePills(pills: [
                        HomePill(
                          id: 'all',
                          label: l10n.lvAll,
                          selected: state.filter.status == null,
                          onTap: () => context.read<UnitsCubit>().applyFilter(state.filter.copyWith(clearStatus: true)),
                        ),
                        HomePill(
                          id: 'available',
                          label: l10n.statusAvailable,
                          dot: catalogAvailable,
                          selected: state.filter.status == UnitStatus.available,
                          onTap: () => context.read<UnitsCubit>().applyFilter(state.filter.copyWith(status: UnitStatus.available)),
                        ),
                        HomePill(
                          id: 'reserved',
                          label: l10n.statusReserved,
                          dot: catalogReserved,
                          selected: state.filter.status == UnitStatus.reserved,
                          onTap: () => context.read<UnitsCubit>().applyFilter(state.filter.copyWith(status: UnitStatus.reserved)),
                        ),
                        HomePill(
                          id: 'sold',
                          label: l10n.statusSold,
                          selected: state.filter.status == UnitStatus.sold,
                          onTap: () => context.read<UnitsCubit>().applyFilter(state.filter.copyWith(status: UnitStatus.sold)),
                        ),
                      ]),
                    ),
                  ),

                  // ── Compare-mode selection hint ────────────────────────
                  if (compareMode && compareCount == 0)
                    SliverToBoxAdapter(
                      child: _SelectionHint(l10n.compareSelectionHint),
                    ),

                  // ── Content ───────────────────────────────────────────
                  ..._buildContent(
                    context,
                    state,
                    l10n,
                    searching: searching,
                    compareCount: compareCount,
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  List<Widget> _buildContent(
    BuildContext context,
    UnitsState state,
    dynamic l10n, {
    required bool searching,
    required int compareCount,
  }) {
    switch (state.status) {
      case DataStatus.initial:
      case DataStatus.loading:
        return [const SliverFillRemaining(child: UnitsGridSkeleton())];

      case DataStatus.failure:
        return [
          SliverFillRemaining(
            child: ErrorState(
              failure: state.failure,
              onRetry: () => context.read<UnitsCubit>().load(),
            ),
          ),
        ];

      case DataStatus.empty:
        return [
          SliverFillRemaining(
            child: EmptyState(
              icon: Icons.search_off_rounded,
              title: l10n.noUnitsTitle,
              message: l10n.noUnitsMessage,
              action: state.filter.activeCount > 0
                  ? AppButton(
                      label: l10n.clearFilters,
                      icon: Icons.tune_rounded,
                      variant: AppButtonVariant.outline,
                      size: AppButtonSize.small,
                      onPressed: () => context
                          .read<UnitsCubit>()
                          .applyFilter(const UnitsFilter()),
                    )
                  : null,
            ),
          ),
        ];

      case DataStatus.success:
        final visible = _applyQuery(state.items);

        if (visible.isEmpty) {
          return [
            SliverFillRemaining(
              child: EmptyState(
                icon: Icons.search_off_rounded,
                title: l10n.noUnitsTitle,
                message: l10n.noUnitsMessage,
                action: searching
                    ? AppButton(
                        label: l10n.clearFilters,
                        icon: Icons.close_rounded,
                        variant: AppButtonVariant.outline,
                        size: AppButtonSize.small,
                        onPressed: () {
                          _search.clear();
                          setState(() {});
                        },
                      )
                    : (state.filter.activeCount > 0
                        ? AppButton(
                            label: l10n.clearFilters,
                            icon: Icons.tune_rounded,
                            variant: AppButtonVariant.outline,
                            size: AppButtonSize.small,
                            onPressed: () => context
                                .read<UnitsCubit>()
                                .applyFilter(const UnitsFilter()),
                          )
                        : null),
              ),
            ),
          ];
        }

        return [
          SliverPadding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.md,
              12,
              AppSpacing.md,
              MediaQuery.paddingOf(context).bottom + 110 + (compareCount > 0 ? 70 : 0),
            ),
            sliver: SliverList.separated(
              itemCount:
                  visible.length + (!searching && state.isLoadingMore ? 1 : 0),
              separatorBuilder: (_, _) => const SizedBox(height: 10),
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
                  index: i,
                  onTap: () => context.push('/units/${unit.id}'),
                )
                    .animate(
                      delay: Duration(milliseconds: math.min(i * 70, 350)),
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

// ─── Compare-mode hint ────────────────────────────────────────────────────────

class _SelectionHint extends StatelessWidget {
  const _SelectionHint(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.sm,
        AppSpacing.lg,
        0,
      ),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: colors.brandGoldSoft,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(
            color: colors.brandGold.withValues(alpha: 0.25),
          ),
        ),
        child: Row(
          children: [
            Icon(
              Icons.compare_arrows_rounded,
              size: 16,
              color: colors.brandGold,
            ),
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
