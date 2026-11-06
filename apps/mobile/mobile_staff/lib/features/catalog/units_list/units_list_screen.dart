import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/catalog_status_label.dart';
import '../../../common/staff_list_skeleton.dart';
import '../../../common/staff_share.dart';
import 'units_list_data.dart';

/// The units list (owner-approved design, 2026-11-04), as the website's
/// units page: the inventory value, the free and the sold units over the
/// whole portfolio; filters by status, project, rooms and price; and the
/// units one under another.
class UnitsListScreen extends StatefulWidget {
  const UnitsListScreen({super.key});

  @override
  State<UnitsListScreen> createState() => _UnitsListScreenState();
}

class _UnitsListScreenState extends State<UnitsListScreen> {
  final _search = TextEditingController();
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<UnitsListCubit>().load();
    _scroll.addListener(() {
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 300) context.read<UnitsListCubit>().loadMore();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _filters() {
    final cubit = context.read<UnitsListCubit>();
    showFilterSheet(
      context,
      (_) => UnitsFilterSheet(query: cubit.state.query, projects: cubit.state.projects, onApply: cubit.apply, count: cubit.count),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<UnitsListCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<UnitsListCubit, UnitsListState>(
          builder: (context, state) {
            final s = state.strip;
            final q = state.query;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                controller: _scroll,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.navUnits,
                      subtitle: s == null ? null : l10n.cuCountN(s.total),
                      back: Navigator.of(context).canPop(),
                      actions: [
                        HomeHeroButton(
                          key: const Key('units-filters'),
                          icon: Icons.tune_rounded,
                          dot: q.advanced,
                          tooltip: l10n.cuFilters,
                          onTap: _filters,
                        ),
                      ],
                      bottom: HomeSearchField(
                        controller: _search,
                        hint: l10n.cuSearchHint,
                        onSubmitted: cubit.setSearch,
                        onClear: () {
                          _search.clear();
                          cubit.setSearch('');
                        },
                      ),
                    ),
                  ),
                  if (s != null) SliverToBoxAdapter(child: _Figures(strip: s)),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: HomePills(pills: [
                        HomePill(id: 'all', label: l10n.lvAll, count: s?.total, selected: q.status == null, onTap: () => cubit.setStatus(null)),
                        for (final (st, n) in [('AVAILABLE', s?.available), ('RESERVED', s?.reserved), ('SOLD', s?.sold)])
                          HomePill(
                            id: st,
                            label: unitStatusLabel(l10n, st),
                            count: n,
                            dot: unitStatusColor(st),
                            selected: q.status == st,
                            onTap: () => cubit.setStatus(st),
                          ),
                      ]),
                    ),
                  ),
                  // Only what is picked in the filter sheet, each with ✕ to drop it.
                  if (q.advanced)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 8, AppSpacing.md, 0),
                        child: Wrap(spacing: 8, runSpacing: 8, children: [
                          if (q.projectId != null)
                            UnitsActiveChip(
                              key: const Key('units-chip-project'),
                              icon: Icons.apartment_rounded,
                              label: state.projectName(q.projectId) ?? l10n.cuProject,
                              onRemove: () => cubit.apply(q.without(project: true)),
                            ),
                          if (q.bedrooms != null)
                            UnitsActiveChip(
                              icon: Icons.bed_rounded,
                              label: l10n.cuRoomsN(q.bedrooms!),
                              onRemove: () => cubit.apply(q.without(bedrooms: true)),
                            ),
                          if (q.priceMin != null || q.priceMax != null)
                            UnitsActiveChip(
                              icon: Icons.payments_rounded,
                              label: [
                                if (q.priceMin != null) '${l10n.cuPriceFrom} ${homeCompactText(q.priceMin!, l10n)}',
                                if (q.priceMax != null) '${l10n.cuPriceTo} ${homeCompactText(q.priceMax!, l10n)}',
                              ].join(' '),
                              onRemove: () => cubit.apply(q.without(price: true)),
                            ),
                        ]),
                      ),
                    ),
                  ..._body(context, state),
                  if (state.loadingMore)
                    const SliverToBoxAdapter(
                      child: Padding(padding: EdgeInsets.all(AppSpacing.md), child: Center(child: CircularProgressIndicator())),
                    ),
                  SliverPadding(padding: EdgeInsets.only(bottom: bottomPad + 40)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  List<Widget> _body(BuildContext context, UnitsListState state) {
    final l10n = context.l10n;
    switch (state.status) {
      case DataStatus.initial:
      case DataStatus.loading:
        return const [SliverToBoxAdapter(child: SizedBox(height: 600, child: StaffListSkeleton()))];
      case DataStatus.failure:
        return [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: context.read<UnitsListCubit>().load))];
      case DataStatus.empty:
        final filtered = state.query.status != null || state.query.advanced || state.query.search.isNotEmpty;
        return [
          SliverToBoxAdapter(
            child: filtered
                ? EmptyState(icon: Icons.filter_list_off_rounded, title: l10n.cuNoMatch)
                : EmptyState(icon: Icons.door_front_door_rounded, title: l10n.cuEmpty, message: l10n.cuEmptyMessage),
          ),
        ];
      case DataStatus.success:
        return [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
            sliver: SliverList.separated(
              itemCount: state.rows.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) => UnitCard(row: state.rows[i]),
            ),
          ),
        ];
    }
  }
}

class _Figures extends StatelessWidget {
  const _Figures({required this.strip});
  final UnitsStrip strip;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (value, unit) = homeCompact(strip.value, l10n);
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
      child: HomeBand(figures: [
        HomeFigure(
          id: 'inventory',
          value: value,
          label: unit.isEmpty ? l10n.cpInventory : l10n.cpInventoryIn(unit),
          hint: l10n.cuCountN(strip.total),
        ),
        HomeFigure(id: 'available', value: '${strip.available}', label: l10n.unitStatusAvailable, hint: l10n.cpOfUnitsN(strip.total)),
        HomeFigure(id: 'sold', value: '${strip.sold}', label: l10n.unitStatusSold, hint: l10n.cuReservedN(strip.reserved)),
      ]),
    );
  }
}

class UnitsActiveChip extends StatelessWidget {
  const UnitsActiveChip({super.key, required this.icon, required this.label, required this.onRemove});
  final IconData icon;
  final String label;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) => InputChip(
        avatar: Icon(icon, size: 16, color: AppPalette.gold500),
        label: Text(label),
        labelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.appColors.inkStrong),
        backgroundColor: homeTint(context),
        side: const BorderSide(color: AppPalette.gold300),
        shape: const StadiumBorder(),
        deleteIcon: const Icon(Icons.close_rounded, size: 16),
        onDeleted: onRemove,
      );
}

/// One unit: the code, status and type; the project and building; the
/// area, rooms, bathrooms and floor; when a reservation lapses; and the
/// price with the calculator and sharing.
class UnitCard extends StatelessWidget {
  const UnitCard({super.key, required this.row, this.onTap, this.actions, this.tag});
  final CatalogUnitRow row;

  /// The broker's pages open their own unit page and offer their own
  /// buttons; the staff ones default to theirs.
  final VoidCallback? onTap;
  final List<Widget>? actions;

  /// One more chip after the specs (the broker's access).
  final (IconData, String)? tag;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final color = unitStatusColor(row.status);
    final where = [if ((row.projectName ?? '').isNotEmpty) row.projectName!, if ((row.buildingName ?? '').isNotEmpty) row.buildingName!].join(' · ');
    String num0(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(1);
    final specs = <(IconData, String)>[
      if (row.area != null) (Icons.straighten_rounded, l10n.unitAreaValue(num0(row.area!))),
      if (row.bedrooms != null) (Icons.bed_rounded, l10n.cuRoomsN(row.bedrooms!)),
      if (row.bathrooms != null) (Icons.bathtub_rounded, ltr('${row.bathrooms}')),
      if (row.floor != null) (Icons.stairs_rounded, row.floor == 0 ? l10n.cuGroundFloor : l10n.cuFloorN(ltr('${row.floor}'))),
      ?tag,
    ];
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: Key('unit-card-${row.id}'),
        onTap: onTap ?? () => context.push('/units/${row.id}'),
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: colors.hairline)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Stack(clipBehavior: Clip.none, children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(15)),
                    child: const Icon(Icons.door_front_door_rounded, color: AppPalette.gold300, size: 22),
                  ),
                  PositionedDirectional(
                    bottom: -3,
                    end: -3,
                    child: Container(
                      width: 13,
                      height: 13,
                      decoration: BoxDecoration(color: color, shape: BoxShape.circle, border: Border.all(color: colors.surface, width: 2.5)),
                    ),
                  ),
                ]),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(
                        child: Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: Text(ltr(row.code), maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(16, colors.inkStrong)),
                        ),
                      ),
                      CatalogBadge.status(unitStatusLabel(l10n, row.status), color),
                    ]),
                    if ((row.typeName ?? '').isNotEmpty)
                      Text(row.typeName!, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    if (where.isNotEmpty)
                      Row(children: [
                        Icon(Icons.apartment_rounded, size: 13, color: colors.inkMuted),
                        const SizedBox(width: 3),
                        Expanded(
                          child: Text(where, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                        ),
                      ]),
                  ]),
                ),
              ]),
            ),
            if (specs.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                child: Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final (icon, text) in specs)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(99)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(icon, size: 13, color: AppPalette.gold500),
                        const SizedBox(width: 4),
                        Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.inkStrong)),
                      ]),
                    ),
                ]),
              ),
            if (row.reservedUntil != null)
              Container(
                margin: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
                decoration: BoxDecoration(color: homeWarnFill(context), borderRadius: BorderRadius.circular(10)),
                child: Row(children: [
                  const Icon(Icons.timer_rounded, size: 14, color: Color(0xFF8A5A12)),
                  const SizedBox(width: 4),
                  Text(l10n.cuReservedUntil(DateFormatter.dayMonth(row.reservedUntil!, languageCode: lang)),
                      key: Key('unit-reserved-${row.id}'), style: const TextStyle(fontSize: 12, color: Color(0xFF8A5A12))),
                ]),
              ),
            Container(
              padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
              decoration: BoxDecoration(
                color: colors.surfaceSoft.withValues(alpha: 0.6),
                border: Border(top: BorderSide(color: colors.hairline)),
              ),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(l10n.cuPrice, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    if (row.price != null)
                      Text.rich(TextSpan(children: [
                        TextSpan(
                          text: ltr(catalogGrouped(row.price!)),
                          style: homeDisplay(18, AppPalette.gold600),
                        ),
                        TextSpan(text: ' ${PriceFormatter.symbol(lang)}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                      ]))
                    else
                      Text(l10n.priceOnRequest, style: TextStyle(fontSize: 13, color: colors.inkMuted)),
                  ]),
                ),
                ...?actions,
                if (actions == null) ...[
                  UnitRoundAction(
                    key: Key('unit-calc-${row.id}'),
                    icon: Icons.calculate_rounded,
                    onTap: () => context.push('/calculator', extra: {'price': row.price, 'projectId': row.projectId}),
                  ),
                  const SizedBox(width: 6),
                  UnitRoundAction(
                    icon: Icons.ios_share_rounded,
                    onTap: () => StaffShare.unit(unitId: row.id, unitCode: row.code, projectName: row.projectName ?? '', l10n: l10n),
                  ),
                ],
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class UnitRoundAction extends StatelessWidget {
  const UnitRoundAction({super.key, required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: AppPalette.navy.withValues(alpha: 0.08),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(width: 36, height: 36, child: Icon(icon, size: 18, color: AppPalette.navy)),
        ),
      );
}

/// The project (with what is free in each), the bedrooms and the price
/// range, as the website's filters, in the filter sheet's look.
class UnitsFilterSheet extends StatefulWidget {
  const UnitsFilterSheet({super.key, required this.query, required this.projects, required this.onApply, required this.count});
  final UnitsQuery query;
  final List<(String, String)> projects;
  final Future<void> Function(UnitsQuery) onApply;

  /// How many units a choice gives.
  final Future<int?> Function(UnitsQuery) count;

  @override
  State<UnitsFilterSheet> createState() => _UnitsFilterSheetState();
}

class _UnitsFilterSheetState extends State<UnitsFilterSheet> with FilterCounting {
  late String? _project = widget.query.projectId;
  late int? _rooms = widget.query.bedrooms;
  late num? _min = widget.query.priceMin;
  late num? _max = widget.query.priceMax;
  final _free = <String?, int?>{};

  UnitsQuery get _draft => UnitsQuery(
        status: widget.query.status,
        search: widget.query.search,
        projectId: _project,
        bedrooms: _rooms,
        priceMin: _min,
        priceMax: _max,
      );

  @override
  Future<int?> countDraft() => widget.count(_draft);

  @override
  void initState() {
    super.initState();
    recount();
    for (final id in [null, ...widget.projects.map((p) => p.$1)]) {
      widget.count(UnitsQuery(status: 'AVAILABLE', projectId: id)).then((n) {
        if (mounted) setState(() => _free[id] = n);
      });
    }
  }

  void _set(VoidCallback f) {
    setState(f);
    recount();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final active = [_project, _rooms, if (_min != null || _max != null) true].where((v) => v != null).length;
    String? free(String? id) => _free[id] == null ? null : l10n.ppAvailableN(_free[id]!);
    return FilterSheet(
      title: l10n.cuFilters,
      active: active,
      applyKey: const Key('units-apply'),
      applyLabel: shown == null ? l10n.cuApply : l10n.cuShowN(shown!),
      onClear: () => _set(() {
        _project = null;
        _rooms = null;
        _min = null;
        _max = null;
      }),
      onApply: () {
        Navigator.of(context).pop();
        widget.onApply(_draft);
      },
      sections: [
        if (widget.projects.isNotEmpty)
          FilterSection(
            icon: Icons.apartment_rounded,
            title: l10n.cuProject,
            hint: l10n.fsAvailableHint,
            child: FilterRadioList<String?>(
              keyPrefix: 'units-project',
              selected: _project,
              onSelect: (v) => _set(() => _project = v),
              options: [
                FilterOption(null, l10n.cuAllProjects, sub: free(null)),
                for (final (id, name) in widget.projects) FilterOption(id, name, sub: free(id)),
              ],
            ),
          ),
        FilterSection(
          icon: Icons.bed_rounded,
          title: l10n.cuBedrooms,
          child: FilterSegments<int?>(
            keyPrefix: 'units-rooms',
            selected: _rooms,
            onSelect: (v) => _set(() => _rooms = v),
            options: [FilterOption(null, l10n.cuAny), for (final n in [1, 2, 3, 4, 5]) FilterOption(n, ltr('$n'))],
          ),
        ),
        FilterSection(
          icon: Icons.payments_rounded,
          title: l10n.cuPrice,
          hint: PriceFormatter.symbol(Localizations.localeOf(context).languageCode),
          child: FilterPriceRange(
            from: _min,
            to: _max,
            onChanged: (a, b) => _set(() {
              _min = a;
              _max = b;
            }),
          ),
        ),
      ],
    );
  }
}
