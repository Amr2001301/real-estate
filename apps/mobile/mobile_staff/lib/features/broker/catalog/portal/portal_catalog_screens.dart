import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/catalog_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../../catalog/kit/catalog_media.dart';
import '../../../catalog/unit_page/unit_page_screen.dart';
import '../../../catalog/units_list/units_list_data.dart';
import '../../../catalog/units_list/units_list_screen.dart';
import '../domain/repositories/broker_catalog_repository.dart';
import 'portal_catalog_data.dart';

/// The broker's catalog (owner-approved designs, 2026-11-04), with the
/// broker portal's pages on the website: the projects the firm may sell
/// (ready to market, the rate, the free units), the units it may see, a
/// project and a unit. A broker sees no reservations of others and no
/// contract values.

String _access(AppLocalizations l10n, String? source) => source == 'UNIT_ACCESS' ? l10n.bcAccessUnit : l10n.bcAccessProject;

void _openUnit(BuildContext context, PortalUnit u) =>
    context.push('/broker/units/${u.row.id}', extra: {'portalUnit': u, 'projectId': u.row.projectId});

void _book(BuildContext context, PortalUnit u) => context.push(
      '/broker/reservations/new',
      extra: {'projectId': u.row.projectId, 'unitId': u.row.id},
    );

/// A unit card with the broker's access, the calculator and "book" for a
/// free unit.
Widget portalUnitCard(BuildContext context, PortalUnit u) {
  final l10n = context.l10n;
  return UnitCard(
    key: Key('portal-unit-${u.row.id}'),
    row: u.row,
    tag: (Icons.verified_user_rounded, _access(l10n, u.accessSource)),
    onTap: () => _openUnit(context, u),
    actions: [
      UnitRoundAction(
        icon: Icons.calculate_rounded,
        onTap: () => context.push('/calculator', extra: {'price': u.row.price, 'projectId': u.row.projectId}),
      ),
      if (u.row.status == 'AVAILABLE') ...[
        const SizedBox(width: 6),
        ActionChip(
          key: Key('portal-unit-book-${u.row.id}'),
          avatar: const Icon(Icons.bookmark_add_rounded, size: 16, color: AppPalette.gold600),
          label: Text(l10n.bcReserve),
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppPalette.gold600),
          backgroundColor: AppPalette.gold50,
          side: const BorderSide(color: AppPalette.gold200),
          shape: const StadiumBorder(),
          onPressed: () => _book(context, u),
        ),
      ],
    ],
  );
}

// ── The projects tab ────────────────────────────────────────────────────────

class PortalProjectsScreen extends StatefulWidget {
  const PortalProjectsScreen({super.key});

  @override
  State<PortalProjectsScreen> createState() => _PortalProjectsScreenState();
}

class _PortalProjectsScreenState extends State<PortalProjectsScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<PortalProjectsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<PortalProjectsCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<PortalProjectsCubit, PortalProjectsState>(
          builder: (context, state) {
            final loaded = state.status == DataStatus.success || state.status == DataStatus.empty;
            final paused = state.rows.length - state.ready;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.navProjects,
                      subtitle: loaded ? l10n.cpCountN(state.rows.length) : null,
                      actions: [
                        HomeHeroButton(
                          key: const Key('portal-units-open'),
                          icon: Icons.door_front_door_rounded,
                          tooltip: l10n.cuAllUnits,
                          onTap: () => context.push('/broker/units'),
                        ),
                      ],
                      bottom: HomeSearchField(
                        controller: _search,
                        hint: l10n.bcSearchHint,
                        onSubmitted: cubit.setSearch,
                        onClear: () {
                          _search.clear();
                          cubit.setSearch('');
                        },
                      ),
                    ),
                  ),
                  if (loaded && state.rows.isNotEmpty) ...[
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: HomeBand(figures: [
                          HomeFigure(id: 'projects', value: '${state.rows.length}', label: l10n.cpProjects, hint: l10n.cpPublishedN(state.published)),
                          HomeFigure(
                            id: 'ready',
                            value: '${state.ready}',
                            label: l10n.bcReady,
                            hint: paused == 0 ? l10n.bcAllActive : l10n.bcPausedN(paused),
                            warn: paused > 0,
                          ),
                          HomeFigure(
                            id: 'available',
                            value: '${state.available}',
                            label: l10n.bcAvailableForYou,
                            hint: l10n.bcInProjectsN(state.rows.where((p) => (p.available ?? 0) > 0).length),
                          ),
                        ]),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 12, bottom: 4),
                        child: HomePills(pills: [
                          HomePill(id: 'all', label: l10n.lvAll, count: state.rows.length, selected: state.filter == null, onTap: () => cubit.setFilter(null)),
                          HomePill(
                            id: 'READY',
                            label: l10n.bcReadyOne,
                            count: state.ready,
                            dot: catalogAvailable,
                            selected: state.filter == 'READY',
                            onTap: () => cubit.setFilter('READY'),
                          ),
                          if (state.featured > 0)
                            HomePill(
                              id: 'FEATURED',
                              label: l10n.cpFeatured,
                              count: state.featured,
                              dot: AppPalette.gold400,
                              selected: state.filter == 'FEATURED',
                              onTap: () => cubit.setFilter('FEATURED'),
                            ),
                        ]),
                      ),
                    ),
                  ],
                  ..._body(context, state),
                  SliverPadding(padding: EdgeInsets.only(bottom: bottomPad + 110)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  List<Widget> _body(BuildContext context, PortalProjectsState state) {
    final l10n = context.l10n;
    switch (state.status) {
      case DataStatus.initial:
      case DataStatus.loading:
        return const [SliverToBoxAdapter(child: SizedBox(height: 600, child: StaffListSkeleton()))];
      case DataStatus.failure:
        return [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: context.read<PortalProjectsCubit>().load))];
      case DataStatus.empty:
        return [SliverToBoxAdapter(child: EmptyState(icon: Icons.apartment_rounded, title: l10n.bcEmpty, message: l10n.bcEmptyMessage))];
      case DataStatus.success:
        final rows = state.visible;
        if (rows.isEmpty) {
          return [SliverToBoxAdapter(child: EmptyState(icon: Icons.filter_list_off_rounded, title: l10n.cpNoMatch))];
        }
        return [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
            sliver: SliverList.separated(
              itemCount: rows.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, i) => PortalProjectCard(row: rows[i], defaultPct: state.defaultPct),
            ),
          ),
        ];
    }
  }
}

/// One project the broker may sell: the cover with "ready to market" or
/// "paused" and "featured", the services, the rate and the free units, and
/// "browse units".
class PortalProjectCard extends StatelessWidget {
  const PortalProjectCard({super.key, required this.row, this.defaultPct});
  final PortalProjectRow row;
  final double? defaultPct;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final commission = portalCommission(row, defaultPct, PriceFormatter.symbol(lang));
    void open() => context.push('/broker/projects/${row.id}', extra: (row, defaultPct));
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(24),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: Key('portal-project-${row.id}'),
        onTap: open,
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(24), border: Border.all(color: colors.hairline)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CatalogCover(
              url: row.coverUrl,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    row.active
                        ? CatalogBadge.status(l10n.bcReadyOne, catalogAvailable, icon: Icons.campaign_rounded)
                        : CatalogBadge.status(l10n.bcPaused, const Color(0xFF6B6256), icon: Icons.pause_rounded),
                    if (row.featured) CatalogBadge.gold(l10n.cpFeatured, icon: Icons.star_rounded),
                  ]),
                  const Spacer(),
                  Text(row.name.resolve(lang), maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(18, Colors.white)),
                  if ((row.city ?? '').isNotEmpty)
                    Row(children: [
                      const Icon(Icons.location_on_rounded, size: 14, color: AppPalette.gold300),
                      const SizedBox(width: 3),
                      Text(row.city!, style: const TextStyle(fontSize: 12, color: Color(0xFFDCE3EC))),
                    ]),
                ]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(13, 12, 13, 13),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (row.services.isNotEmpty)
                  Wrap(spacing: 5, runSpacing: 5, children: [
                    for (final s in row.services.take(3))
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(99)),
                        child: Text(s, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.inkMuted)),
                      ),
                    if (row.services.length > 3)
                      Text(ltr('+${row.services.length - 3}'), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                  ]),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(
                    child: _Mini(
                      label: l10n.bcCommission,
                      value: commission == null ? '—' : ltr(commission.text),
                      note: commission?.isDefault == true ? l10n.bcDefault : null,
                      valueKey: Key('portal-commission-${row.id}'),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(child: _Mini(label: l10n.bcAvailableForYou, value: row.available == null ? '—' : ltr('${row.available}'))),
                ]),
                const SizedBox(height: 11),
                FilledButton.icon(
                  onPressed: () => context.push('/broker/units?projectId=${row.id}'),
                  icon: const Icon(Icons.door_front_door_rounded, size: 18),
                  label: Text(l10n.bcBrowseUnits),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(42),
                    backgroundColor: AppPalette.navy,
                    foregroundColor: AppPalette.gold300,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                  ),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini({required this.label, required this.value, this.note, this.valueKey});
  final String label;
  final String value;
  final String? note;
  final Key? valueKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
      decoration: BoxDecoration(
        color: homeTint(context),
        border: Border.all(color: homeTintBorder(context)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        Text(value, key: valueKey, maxLines: 1, overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: colors.inkStrong)),
        if (note != null) Text(note!, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
      ]),
    );
  }
}

// ── The units list ──────────────────────────────────────────────────────────

class PortalUnitsScreen extends StatefulWidget {
  const PortalUnitsScreen({super.key});

  @override
  State<PortalUnitsScreen> createState() => _PortalUnitsScreenState();
}

class _PortalUnitsScreenState extends State<PortalUnitsScreen> {
  final _search = TextEditingController();
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<PortalUnitsCubit>().load();
    _scroll.addListener(() {
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 300) context.read<PortalUnitsCubit>().loadMore();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _filters() {
    final cubit = context.read<PortalUnitsCubit>();
    showFilterSheet(
      context,
      (_) => UnitsFilterSheet(query: cubit.state.query, projects: cubit.state.projects, onApply: cubit.apply, count: cubit.count),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<PortalUnitsCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<PortalUnitsCubit, PortalUnitsState>(
          builder: (context, state) {
            final c = state.counts;
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
                      subtitle: c == null ? null : l10n.cuCountN(c.total),
                      back: Navigator.of(context).canPop(),
                      actions: [
                        HomeHeroButton(key: const Key('portal-units-filters'), icon: Icons.tune_rounded, dot: q.advanced, onTap: _filters),
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
                  if (c != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: HomeBand(figures: [
                          HomeFigure(id: 'available', value: '${c.available}', label: l10n.bcAvailableShort, hint: l10n.cpOfUnitsN(c.total)),
                          HomeFigure(id: 'reserved', value: '${c.reserved}', label: l10n.unitStatusReserved, hint: l10n.bcNotBookable),
                          HomeFigure(id: 'sold', value: '${c.sold}', label: l10n.unitStatusSold, hint: l10n.bcInProjectsN(state.projects.length)),
                        ]),
                      ),
                    ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: HomePills(pills: [
                        HomePill(id: 'all', label: l10n.lvAll, count: c?.total, selected: q.status == null, onTap: () => cubit.setStatus(null)),
                        for (final (st, n) in [('AVAILABLE', c?.available), ('RESERVED', c?.reserved), ('SOLD', c?.sold)])
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
                  if (q.advanced)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 8, AppSpacing.md, 0),
                        child: Wrap(spacing: 8, runSpacing: 8, children: [
                          if (q.projectId != null)
                            UnitsActiveChip(
                              key: const Key('portal-units-chip-project'),
                              icon: Icons.apartment_rounded,
                              label: state.projectName(q.projectId) ?? l10n.cuProject,
                              onRemove: () => cubit.apply(q.without(project: true)),
                            ),
                          if (q.bedrooms != null)
                            UnitsActiveChip(icon: Icons.bed_rounded, label: l10n.cuRoomsN(q.bedrooms!), onRemove: () => cubit.apply(q.without(bedrooms: true))),
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
                    const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.all(AppSpacing.md), child: Center(child: CircularProgressIndicator()))),
                  SliverPadding(padding: EdgeInsets.only(bottom: bottomPad + 40)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  List<Widget> _body(BuildContext context, PortalUnitsState state) {
    final l10n = context.l10n;
    switch (state.status) {
      case DataStatus.initial:
      case DataStatus.loading:
        return const [SliverToBoxAdapter(child: SizedBox(height: 600, child: StaffListSkeleton()))];
      case DataStatus.failure:
        return [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: context.read<PortalUnitsCubit>().load))];
      case DataStatus.empty:
        return [SliverToBoxAdapter(child: EmptyState(icon: Icons.door_front_door_rounded, title: l10n.cuNoMatch, message: l10n.bcUnitsEmptyMessage))];
      case DataStatus.success:
        return [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
            sliver: SliverList.separated(
              itemCount: state.rows.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) => portalUnitCard(context, state.rows[i]),
            ),
          ),
        ];
    }
  }
}

// ── A project ───────────────────────────────────────────────────────────────

class PortalProjectPage extends StatefulWidget {
  const PortalProjectPage({super.key, required this.project, this.defaultPct});
  final PortalProjectRow project;
  final double? defaultPct;

  @override
  State<PortalProjectPage> createState() => _PortalProjectPageState();
}

class _PortalProjectPageState extends State<PortalProjectPage> {
  ProjectPlanSummary _plans = const ProjectPlanSummary();
  List<PortalUnit> _free = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    // After the first frame: the language comes from the tree.
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final lang = Localizations.localeOf(context).languageCode;
    final repo = PortalCatalogRepository(context.read<Dio>());
    final catalog = context.read<BrokerCatalogRepository>();
    final results = await Future.wait<Object?>([
      repo.units(UnitsQuery(projectId: widget.project.id, status: 'AVAILABLE'), 1, lang: lang),
      catalog.projectPlans(widget.project.id),
    ]);
    if (!mounted) return;
    setState(() {
      _loading = false;
      _free = (results[0]! as Result<(List<PortalUnit>, int)>).dataOrNull?.$1 ?? const [];
      if ((results[1]! as Result<ProjectPlanSummary>) case Ok(:final data)) _plans = data;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final p = widget.project;
    final commission = portalCommission(p, widget.defaultPct, PriceFormatter.symbol(lang));
    final cheapest = _free.map((u) => u.row.price).whereType<double>().fold<double?>(null, (a, b) => a == null || b < a ? b : a);
    final planLine = projectOfferLine(l10n, _plans);
    final desc = p.description?.resolve(lang) ?? '';
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: Column(children: [
          Expanded(
            child: ListView(padding: EdgeInsets.zero, children: [
              HomeOverlap(
                overlap: 30,
                top: CatalogPageHero(
                height: 270,
                photos: [?p.coverUrl],
                badges: [
                  p.active
                      ? CatalogBadge.status(l10n.bcReadyOne, catalogAvailable, icon: Icons.campaign_rounded)
                      : CatalogBadge.status(l10n.bcPaused, const Color(0xFF6B6256), icon: Icons.pause_rounded),
                  if (p.featured) CatalogBadge.gold(l10n.cpFeatured, icon: Icons.star_rounded),
                ],
                title: p.name.resolve(lang),
                place: p.city ?? '',
              ),
                bottom: Container(
                  margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: homeLine(context)),
                    boxShadow: const [BoxShadow(color: Color(0x290F1E33), blurRadius: 40, offset: Offset(0, 18))],
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Text(l10n.detailPricesFrom, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    if (cheapest != null)
                      Text.rich(
                        key: const Key('portal-project-from'),
                        TextSpan(children: [
                          TextSpan(text: ltr(catalogGrouped(cheapest)), style: homeDisplay(25, colors.inkStrong)),
                          TextSpan(text: ' ${PriceFormatter.symbol(lang)}', style: TextStyle(fontSize: 13, color: colors.inkMuted)),
                        ]),
                      )
                    else
                      Text(_loading ? '…' : l10n.priceOnRequest, style: homeDisplay(19, colors.inkMuted)),
                    if (planLine != null)
                      Text(planLine, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: catalogAvailable)),
                    const SizedBox(height: 11),
                    Row(children: [
                      Expanded(
                        child: _Mini(
                          label: l10n.bcCommission,
                          value: commission == null ? '—' : ltr(commission.text),
                          note: commission?.isDefault == true ? l10n.bcDefault : null,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(child: _Mini(label: l10n.bcAvailableForYou, value: p.available == null ? '—' : ltr('${p.available}'))),
                      const SizedBox(width: 6),
                      Expanded(
                        child: _Mini(
                          label: l10n.bcYourAccess,
                          value: p.endsAt == null ? l10n.bcNoEnd : l10n.bcUntil(DateFormatter.dayMonth(p.endsAt!, languageCode: lang)),
                        ),
                      ),
                    ]),
                  ]),
                ),
              ),
              const SizedBox(height: 30),
              HomeSection(
                icon: Icons.info_rounded,
                title: l10n.projectAbout,
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: homeCard(context),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Text(desc.isEmpty ? l10n.ppNoDescription : desc,
                        style: TextStyle(fontSize: 13, height: 1.85, color: desc.isEmpty ? colors.inkMuted : colors.ink)),
                    if (p.services.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Divider(height: 1, color: colors.hairline),
                      const SizedBox(height: 10),
                      for (final s in p.services)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Row(children: [
                            Container(
                              width: 28,
                              height: 28,
                              decoration: BoxDecoration(color: homeTint(context), borderRadius: BorderRadius.circular(9)),
                              child: const Icon(Icons.check_rounded, size: 16, color: AppPalette.gold500),
                            ),
                            const SizedBox(width: 8),
                            Expanded(child: Text(s, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: colors.inkStrong))),
                          ]),
                        ),
                    ],
                  ]),
                ),
              ),
              if (!_plans.isEmpty)
                HomeSection(icon: Icons.payments_rounded, title: l10n.detailPaymentPlans, child: AppPlanOfferCards(plans: _plans)),
              HomeSection(
                icon: Icons.door_front_door_rounded,
                title: l10n.bcFreeForYou,
                action: l10n.cuAllUnits,
                onAction: () => context.push('/broker/units?projectId=${p.id}'),
                child: _loading
                    ? const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator()))
                    : _free.isEmpty
                        ? Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: homeCard(context),
                            child: Text(l10n.ppNoFree, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
                          )
                        : Column(children: [
                            for (final u in _free.take(5)) ...[portalUnitCard(context, u), const SizedBox(height: 10)],
                          ]),
              ),
              if (p.hasLocation)
                HomeSection(
                  icon: Icons.map_rounded,
                  title: l10n.projectLocation,
                  action: l10n.openInMaps,
                  onAction: () => ContactActions.openMap(lat: p.lat!, lng: p.lng!, label: p.name.resolve(lang)),
                  child: CatalogMap(lat: p.lat!, lng: p.lng!, label: p.name.resolve(lang), openLabel: l10n.openInMaps),
                ),
              const SizedBox(height: 24),
            ]),
          ),
          _BottomButton(
            buttonKey: const Key('portal-project-add-lead'),
            icon: Icons.person_add_rounded,
            label: l10n.brokerLeadNew,
            onTap: () => context.push('/broker/leads/new', extra: {'projectId': p.id}),
          ),
        ]),
      ),
    );
  }
}

// ── A unit ──────────────────────────────────────────────────────────────────

class PortalUnitPage extends StatefulWidget {
  const PortalUnitPage({super.key, required this.unit});
  final PortalUnit unit;

  @override
  State<PortalUnitPage> createState() => _PortalUnitPageState();
}

class _PortalUnitPageState extends State<PortalUnitPage> {
  List<InstallmentOffer> _offers = const [];

  @override
  void initState() {
    super.initState();
    _loadOffers();
  }

  // Best-effort: the page shows without them.
  Future<void> _loadOffers() async {
    final result = await context.read<BrokerCatalogRepository>().unitPlans(widget.unit.row.id);
    if (!mounted) return;
    if (result case Ok(:final data)) setState(() => _offers = data);
  }

  void _calculate() {
    final u = widget.unit.row;
    final lang = Localizations.localeOf(context).languageCode;
    if (_offers.every((o) => o.options.isEmpty)) {
      context.push('/calculator', extra: {'price': u.price, 'projectId': u.projectId});
      return;
    }
    showInstallmentCalculator(
      context,
      subtitle: [ltr(u.code), if (u.price != null) PriceFormatter.format(u.price!, languageCode: lang)].join(' · '),
      offers: _offers,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final u = widget.unit;
    final r = u.row;
    final where = [if ((r.projectName ?? '').isNotEmpty) r.projectName!, if ((r.buildingName ?? '').isNotEmpty) r.buildingName!].join(' · ');
    Widget cell(String k, String? v) => Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(k, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              Text((v ?? '').isEmpty ? '—' : v!, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            ]),
          ),
        );
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: Column(children: [
          Expanded(
            child: ListView(padding: EdgeInsets.zero, children: [
              HomeOverlap(
                overlap: 30,
                top: CatalogPageHero(
                height: 260,
                photos: u.photos,
                badges: [
                  CatalogBadge.status(unitStatusLabel(l10n, r.status), unitStatusColor(r.status)),
                  if ((r.typeName ?? '').isNotEmpty) CatalogBadge.glass(r.typeName!),
                ],
                title: l10n.unitTitle(ltr(r.code)),
                place: where,
              ),
                bottom: UnitPriceCard(price: r.price, handover: u.specs.deliveryDate, offers: _offers, onCalculate: _calculate),
              ),
              const SizedBox(height: 30),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                child: UnitFacts(area: r.area, bedrooms: r.bedrooms, bathrooms: r.bathrooms, floor: r.floor),
              ),
              HomeSection(
                icon: Icons.list_alt_rounded,
                title: l10n.upSpecs,
                child: UnitSpecTable(code: r.code, typeName: r.typeName, specs: u.specs, extra: [(l10n.bcYourAccess, _access(l10n, u.accessSource))]),
              ),
              if (u.floorPlans.isNotEmpty)
                HomeSection(icon: Icons.architecture_rounded, title: l10n.sectionFloorPlans, child: CatalogFloorPlans(urls: u.floorPlans)),
              HomeSection(
                icon: Icons.apartment_rounded,
                title: l10n.upProject,
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: homeCard(context, radius: 22),
                  child: Column(children: [
                    Row(children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(13)),
                        child: const Icon(Icons.apartment_rounded, color: AppPalette.gold300, size: 20),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(l10n.upProject, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                          Text(r.projectName ?? '—', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                        ]),
                      ),
                    ]),
                    const SizedBox(height: 10),
                    Divider(height: 1, color: colors.hairline),
                    Row(children: [cell(l10n.upPhase, u.phaseName), cell(l10n.upBuilding, r.buildingName)]),
                    Row(children: [cell(l10n.labelCity, u.projectCity), const Spacer()]),
                  ]),
                ),
              ),
              if (u.hasLocation)
                HomeSection(
                  icon: Icons.map_rounded,
                  title: l10n.projectLocation,
                  child: CatalogMap(lat: u.lat!, lng: u.lng!, label: ltr(r.code), openLabel: l10n.openInMaps),
                ),
              const SizedBox(height: 24),
            ]),
          ),
          if (r.status == 'AVAILABLE')
            _BottomButton(
              buttonKey: const Key('portal-unit-reserve'),
              icon: Icons.bookmark_add_rounded,
              label: l10n.reservationCreate,
              onTap: () => _book(context, u),
            ),
        ]),
      ),
    );
  }
}

class _BottomButton extends StatelessWidget {
  const _BottomButton({required this.icon, required this.label, required this.onTap, this.buttonKey});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Key? buttonKey;

  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.paddingOf(context).bottom),
        decoration: BoxDecoration(
          color: context.appColors.canvas,
          border: Border(top: BorderSide(color: context.appColors.hairline)),
        ),
        child: FilledButton.icon(
          key: buttonKey,
          onPressed: onTap,
          icon: Icon(icon, size: 19),
          label: Text(label),
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            backgroundColor: AppPalette.gold400,
            foregroundColor: AppPalette.navy,
            textStyle: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
          ),
        ),
      );
}

/// Opens a project from a link, a reload or the home: finds it among the
/// broker's projects.
class PortalProjectLoader extends StatelessWidget {
  const PortalProjectLoader({super.key, required this.projectId});
  final String projectId;

  @override
  Widget build(BuildContext context) => FutureBuilder<Result<(List<PortalProjectRow>, double?)>>(
        future: PortalCatalogRepository(context.read<Dio>()).projects(),
        builder: (context, snap) {
          final d = snap.data?.dataOrNull;
          final p = d?.$1.where((p) => p.id == projectId).firstOrNull;
          if (p != null) return PortalProjectPage(project: p, defaultPct: d!.$2);
          return Scaffold(
            body: Column(children: [
              const HomeListHero(title: '', back: true),
              Expanded(
                child: snap.connectionState != ConnectionState.done
                    ? const Center(child: CircularProgressIndicator())
                    : EmptyState(icon: Icons.apartment_rounded, title: context.l10n.bcEmpty),
              ),
            ]),
          );
        },
      );
}
