import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/catalog_status_label.dart';
import '../../../common/staff_list_skeleton.dart';
import 'projects_list_data.dart';

/// The projects list (owner-approved design, 2026-11-04), with the website's
/// projects page figures: how many projects (and published), the units free
/// out of all of them, the inventory value; filters by status and
/// "featured"; and on each card the units by status, the unit types, the
/// starting price and — for the admin — the contract value.
class ProjectsListScreen extends StatefulWidget {
  const ProjectsListScreen({super.key});

  @override
  State<ProjectsListScreen> createState() => _ProjectsListScreenState();
}

class _ProjectsListScreenState extends State<ProjectsListScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<ProjectsListCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ProjectsListCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<ProjectsListCubit, ProjectsListState>(
          builder: (context, state) {
            final d = state.data;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.navProjects,
                      subtitle: d == null ? null : l10n.cpCountN(d.projects),
                      back: Navigator.of(context).canPop(),
                      actions: [
                        HomeHeroButton(
                          key: const Key('projects-units'),
                          icon: Icons.door_front_door_rounded,
                          tooltip: l10n.cuAllUnits,
                          onTap: () => context.push('/units'),
                        ),
                      ],
                      bottom: HomeSearchField(
                        controller: _search,
                        hint: l10n.cpSearchHint,
                        onSubmitted: cubit.setSearch,
                        onClear: () {
                          _search.clear();
                          cubit.setSearch('');
                        },
                      ),
                    ),
                  ),
                  if (d != null) ...[
                    SliverToBoxAdapter(child: _Figures(data: d)),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 12, bottom: 4),
                        child: HomePills(pills: [
                          HomePill(id: 'all', label: l10n.lvAll, count: d.projects, selected: state.filter == null, onTap: () => cubit.setFilter(null)),
                          HomePill(
                            id: 'PUBLISHED',
                            label: l10n.projectStatusPublished,
                            count: d.published,
                            dot: catalogAvailable,
                            selected: state.filter == 'PUBLISHED',
                            onTap: () => cubit.setFilter('PUBLISHED'),
                          ),
                          if (d.drafts > 0)
                            HomePill(
                              id: 'DRAFT',
                              label: l10n.projectStatusDraft,
                              count: d.drafts,
                              dot: const Color(0xFF8A7F70),
                              selected: state.filter == 'DRAFT',
                              onTap: () => cubit.setFilter('DRAFT'),
                            ),
                          if (d.archived > 0)
                            HomePill(
                              id: 'ARCHIVED',
                              label: l10n.projectStatusArchived,
                              count: d.archived,
                              dot: catalogReserved,
                              selected: state.filter == 'ARCHIVED',
                              onTap: () => cubit.setFilter('ARCHIVED'),
                            ),
                          if (d.featured > 0)
                            HomePill(
                              id: 'FEATURED',
                              label: l10n.cpFeatured,
                              count: d.featured,
                              dot: AppPalette.gold400,
                              selected: state.filter == 'FEATURED',
                              onTap: () => cubit.setFilter('FEATURED'),
                            ),
                        ]),
                      ),
                    ),
                  ],
                  ..._body(context, state),
                  SliverPadding(padding: EdgeInsets.only(bottom: bottomPad + 40)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  List<Widget> _body(BuildContext context, ProjectsListState state) {
    final l10n = context.l10n;
    if (state.data == null) {
      return state.status == DataStatus.failure
          ? [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: context.read<ProjectsListCubit>().load))]
          : const [SliverToBoxAdapter(child: SizedBox(height: 600, child: StaffListSkeleton()))];
    }
    final rows = state.visible;
    if (rows.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: state.data!.rows.isEmpty && state.search.isEmpty
              ? EmptyState(icon: Icons.apartment_rounded, title: l10n.cpEmpty, message: l10n.cpEmptyMessage)
              : EmptyState(icon: Icons.filter_list_off_rounded, title: l10n.cpNoMatch),
        ),
      ];
    }
    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
        sliver: SliverList.separated(
          itemCount: rows.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, i) => ProjectCard(row: rows[i]),
        ),
      ),
    ];
  }
}

/// The navy band: the projects (published), the free units out of all, the
/// inventory value (sold, reserved) — the website's strips.
class _Figures extends StatelessWidget {
  const _Figures({required this.data});
  final ProjectsOverview data;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (value, unit) = homeCompact(data.inventoryValue, l10n);
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
      child: HomeBand(figures: [
        HomeFigure(id: 'projects', value: '${data.projects}', label: l10n.cpProjects, hint: l10n.cpPublishedN(data.published)),
        HomeFigure(id: 'available', value: '${data.unitsAvailable}', label: l10n.cpAvailableUnits, hint: l10n.cpOfUnitsN(data.unitsTotal)),
        HomeFigure(
          id: 'inventory',
          value: value,
          label: unit.isEmpty ? l10n.cpInventory : l10n.cpInventoryIn(unit),
          hint: l10n.cpSoldReserved(data.unitsSold, data.unitsReserved),
        ),
      ]),
    );
  }
}

/// One project: the cover with its status, "featured", the type, the name
/// and the place; the units bar; the unit types; from what price; and the
/// contract value for the admin.
class ProjectCard extends StatelessWidget {
  const ProjectCard({super.key, required this.row});
  final CatalogProjectRow row;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final type = projectTypeLabel(l10n, row.type);
    final place = row.place(lang);
    final statusColor = switch (row.status) {
      'PUBLISHED' => catalogAvailable,
      'ARCHIVED' => catalogReserved,
      _ => const Color(0xFF6B6256),
    };
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(24),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: Key('project-card-${row.id}'),
        onTap: () => context.push('/projects/${row.id}'),
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(24), border: Border.all(color: colors.hairline)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CatalogCover(
              url: row.coverUrl,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    CatalogBadge.status(
                      projectStatusLabel(l10n, row.status),
                      statusColor,
                      icon: row.status == 'PUBLISHED' ? Icons.public_rounded : null,
                    ),
                    if (row.featured) CatalogBadge.gold(l10n.cpFeatured, icon: Icons.star_rounded),
                    if (type.isNotEmpty) CatalogBadge.glass(type),
                  ]),
                  const Spacer(),
                  Text(row.name.resolve(lang), maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(18, Colors.white)),
                  if (place.isNotEmpty)
                    Row(children: [
                      const Icon(Icons.location_on_rounded, size: 14, color: AppPalette.gold300),
                      const SizedBox(width: 3),
                      Expanded(
                        child: Text(place,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Color(0xFFDCE3EC))),
                      ),
                    ]),
                ]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(13, 12, 13, 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                CatalogUnitsMix(available: row.available, reserved: row.reserved, sold: row.sold, other: row.other),
                if (row.unitTypes.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(spacing: 5, runSpacing: 5, children: [
                    for (final t in row.unitTypes)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(99)),
                        child: Text(t, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.inkMuted)),
                      ),
                  ]),
                ],
                if (row.startingPrice != null || row.contractValue != null) ...[
                  const SizedBox(height: 11),
                  Divider(height: 1, color: colors.hairline),
                  const SizedBox(height: 10),
                  Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    if (row.startingPrice != null)
                      Expanded(
                        child: _Money(
                          label: l10n.cpFrom,
                          value: row.startingPrice!,
                          currency: currency,
                          color: AppPalette.gold600,
                          valueKey: Key('project-from-${row.id}'),
                        ),
                      )
                    else
                      const Spacer(),
                    if (row.contractValue != null)
                      _Money(
                        label: l10n.cpContractValueN(row.signedContracts ?? 0),
                        value: row.contractValue!,
                        currency: currency,
                        color: colors.inkStrong,
                        end: true,
                        valueKey: Key('project-value-${row.id}'),
                      ),
                  ]),
                ],
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _Money extends StatelessWidget {
  const _Money({required this.label, required this.value, required this.currency, required this.color, this.end = false, this.valueKey});
  final String label;
  final double value;
  final String currency;
  final Color color;
  final bool end;
  final Key? valueKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final (n, unit) = homeCompact(value, context.l10n);
    return Column(crossAxisAlignment: end ? CrossAxisAlignment.end : CrossAxisAlignment.start, children: [
      Text(label, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
      Text.rich(
        key: valueKey,
        TextSpan(children: [
          TextSpan(text: ltr(n), style: homeDisplay(19, color)),
          TextSpan(text: ' ${'$unit $currency'.trim()}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        ]),
      ),
    ]);
  }
}
