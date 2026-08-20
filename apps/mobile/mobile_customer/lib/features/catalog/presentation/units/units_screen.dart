import 'dart:math' as math;

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/unit.dart';
import '../compare/compare_cubit.dart';
import '../widgets/catalog_controls.dart';
import '../widgets/catalog_skeletons.dart';
import '../widgets/unit_card.dart';
import 'units_cubit.dart';
import 'units_filters_sheet.dart';
import 'units_state.dart';

// ─── Shared navy palette (matches projects_screen) ───────────────────────────
const Color _navyLight = Color(0xFF24426A);
const Color _navyMid = Color(0xFF14273F);
const Color _navyDeep = Color(0xFF0B1726);

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
    final topInset = MediaQuery.paddingOf(context).top;
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
                  // ── Immersive navy header ──────────────────────────────
                  SliverPersistentHeader(
                    pinned: true,
                    delegate: _UnitsHeaderDelegate(
                      topInset: topInset,
                      searchController: _search,
                      onSearchChange: (_) => setState(() {}),
                      onSearchSubmit: (_) => setState(() {}),
                      onSearchClear: () {
                        _search.clear();
                        setState(() {});
                      },
                      onFilter: _openFilters,
                      activeFilterCount: state.filter.activeCount,
                      itemCount: state.status == DataStatus.success
                          ? _applyQuery(state.items).length
                          : null,
                    ),
                  ),

                  // ── Compare-mode selection hint ────────────────────────
                  if (compareMode && compareCount == 0)
                    SliverToBoxAdapter(
                      child: _SelectionHint(l10n.compareSelectionHint),
                    ),

                  // ── Active filter chips ────────────────────────────────
                  if (state.filter.activeCount > 0)
                    SliverToBoxAdapter(
                      child: _ActiveFilterBar(filter: state.filter),
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
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg +
                  MediaQuery.paddingOf(context).bottom +
                  (compareCount > 0
                      ? (context.isApplePlatform ? 144 : 96)
                      : 0),
            ),
            sliver: SliverList.separated(
              itemCount:
                  visible.length + (!searching && state.isLoadingMore ? 1 : 0),
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

// ─── Immersive header delegate ────────────────────────────────────────────────

class _UnitsHeaderDelegate extends SliverPersistentHeaderDelegate {
  _UnitsHeaderDelegate({
    required this.topInset,
    required this.searchController,
    required this.onSearchChange,
    required this.onSearchSubmit,
    required this.onSearchClear,
    required this.onFilter,
    required this.activeFilterCount,
    required this.itemCount,
  });

  final double topInset;
  final TextEditingController searchController;
  final ValueChanged<String> onSearchChange;
  final ValueChanged<String> onSearchSubmit;
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
  bool shouldRebuild(_UnitsHeaderDelegate old) =>
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
          // Title row
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
                  SizedBox(
                    width: 44,
                    child: canPop
                        ? _HeaderIconButton(
                            icon: Icons.arrow_back_ios_rounded,
                            onTap: () => Navigator.of(context).maybePop(),
                          )
                        : null,
                  ),
                  Expanded(
                    child: Center(
                      child: Text(
                        l10n.unitsTitle,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
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

          // Search row (fades out when collapsing)
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
                          hint: l10n.unitsSearchHint,
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

          // Bottom gold hairline accent
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

class _ActiveFilterBar extends StatelessWidget {
  const _ActiveFilterBar({required this.filter});
  final UnitsFilter filter;

  String _statusLabel(dynamic l10n, UnitStatus s) => switch (s) {
        UnitStatus.available => l10n.statusAvailable,
        UnitStatus.reserved => l10n.statusReserved,
        UnitStatus.sold => l10n.statusSold,
        UnitStatus.unknown => '',
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    final chips = <_ChipData>[
      if (filter.status != null)
        _ChipData(
          label: _statusLabel(l10n, filter.status!),
          onRemove: () => context
              .read<UnitsCubit>()
              .applyFilter(filter.copyWith(clearStatus: true)),
        ),
      if (filter.bedrooms != null)
        _ChipData(
          label: '${filter.bedrooms} ${l10n.filterRooms}',
          onRemove: () => context
              .read<UnitsCubit>()
              .applyFilter(filter.copyWith(clearBedrooms: true)),
        ),
      if (filter.priceMin != null || filter.priceMax != null)
        _ChipData(
          label: l10n.filterPriceRange,
          onRemove: () => context
              .read<UnitsCubit>()
              .applyFilter(filter.copyWith(clearPrice: true)),
        ),
      if (filter.areaMin != null || filter.areaMax != null)
        _ChipData(
          label: l10n.filterAreaRange,
          onRemove: () => context
              .read<UnitsCubit>()
              .applyFilter(filter.copyWith(clearArea: true)),
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
              _ActiveChip(data: chip),
              const SizedBox(width: AppSpacing.xs),
            ],
          ],
        ),
      ),
    );
  }
}

class _ChipData {
  const _ChipData({required this.label, required this.onRemove});
  final String label;
  final VoidCallback onRemove;
}

class _ActiveChip extends StatelessWidget {
  const _ActiveChip({required this.data});
  final _ChipData data;

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
              child: Icon(
                Icons.close_rounded,
                size: 13,
                color: colors.brandGold,
              ),
            ),
          ),
        ],
      ),
    );
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
