import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/catalog_status_label.dart';
import '../../../common/staff_share.dart';
import '../../dashboard/home_kit/home_kit.dart';
import '../../installments/domain/repositories/installments_repository.dart';
import '../../leads/domain/repositories/leads_repository.dart';
import '../kit/catalog_kit.dart';
import '../kit/catalog_media.dart';
import '../units_list/units_list_screen.dart';
import 'project_page_data.dart';

/// A project's page (owner-approved design, 2026-11-04), with the website's
/// project page: a calm cover (status, name, place); the occupancy and
/// the units by status; the units, phases and buildings; the facts, the
/// description and the services; the phases with each building's free and
/// sold units; the cheapest free units; the payment plans and floor plans
/// when there are any; and the map.
class ProjectPageScreen extends StatefulWidget {
  const ProjectPageScreen({super.key});

  @override
  State<ProjectPageScreen> createState() => _ProjectPageScreenState();
}

class _ProjectPageScreenState extends State<ProjectPageScreen> {
  ProjectPlanSummary _plans = const ProjectPlanSummary();

  @override
  void initState() {
    super.initState();
    final cubit = context.read<ProjectPageCubit>();
    cubit.load();
    _loadPlans(cubit.projectId);
  }

  // Best-effort: the page shows without them.
  Future<void> _loadPlans(String projectId) async {
    final InstallmentsRepository repo;
    try {
      repo = context.read<InstallmentsRepository>();
    } catch (_) {
      return;
    }
    final result = await repo.projectOffers(projectId);
    if (!mounted) return;
    if (result case Ok(:final data)) setState(() => _plans = ProjectPlanSummary.fromOffers(data));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<ProjectPageCubit, DataState<ProjectPage>>(
          builder: (context, state) {
            final p = state.data;
            if (p == null) {
              return Column(children: [
                const HomeListHero(title: '', back: true),
                Expanded(
                  child: state.status == DataStatus.failure
                      ? ErrorState(failure: state.failure, onRetry: context.read<ProjectPageCubit>().load)
                      : const Center(child: CircularProgressIndicator()),
                ),
              ]);
            }
            return Column(children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: context.read<ProjectPageCubit>().load,
                  child: ListView(padding: EdgeInsets.zero, children: [
                    _Hero(page: p),
                    Transform.translate(offset: const Offset(0, -30), child: _Occupancy(page: p)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                      child: HomeBand(figures: [
                        HomeFigure(id: 'units', value: '${p.total}', label: l10n.ppUnits, hint: l10n.ppAvailableN(p.available)),
                        HomeFigure(
                          id: 'phases',
                          value: '${p.phases.length}',
                          label: l10n.ppPhases,
                          hint: p.delivery == null ? l10n.ppNoDelivery : l10n.ppDeliveryYear(ltr('${p.delivery!.year}')),
                        ),
                        HomeFigure(
                          id: 'buildings',
                          value: '${p.buildings}',
                          label: l10n.ppBuildings,
                          hint: p.maxFloors == null ? '—' : l10n.ppFloorsN(p.maxFloors!),
                        ),
                      ]),
                    ),
                    HomeSection(icon: Icons.info_rounded, title: l10n.projectAbout, child: _About(page: p)),
                    HomeSection(icon: Icons.layers_rounded, title: l10n.ppPhasesBuildings, child: _Phases(page: p)),
                    HomeSection(
                      icon: Icons.door_front_door_rounded,
                      title: l10n.ppFreeUnits,
                      action: l10n.cuAllUnits,
                      onAction: () => context.push('/units?projectId=${p.id}'),
                      child: p.freeUnits.isEmpty
                          ? _Note(l10n.ppNoFree)
                          : Column(children: [
                              for (final u in p.freeUnits) ...[UnitCard(row: u), const SizedBox(height: 10)],
                            ]),
                    ),
                    if (!_plans.isEmpty)
                      HomeSection(icon: Icons.payments_rounded, title: l10n.detailPaymentPlans, child: AppPlanOfferCards(plans: _plans)),
                    if (p.floorPlans.isNotEmpty)
                      HomeSection(icon: Icons.architecture_rounded, title: l10n.sectionFloorPlans, child: CatalogFloorPlans(urls: p.floorPlans)),
                    if (p.hasLocation)
                      HomeSection(
                        icon: Icons.map_rounded,
                        title: l10n.projectLocation,
                        action: l10n.openInMaps,
                        onAction: () => ContactActions.openMap(lat: p.lat!, lng: p.lng!, label: p.name.resolve('ar')),
                        child: CatalogMap(lat: p.lat!, lng: p.lng!, label: p.name.resolve('ar'), openLabel: l10n.openInMaps),
                      ),
                    const SizedBox(height: 24),
                  ]),
                ),
              ),
              _Bar(page: p),
            ]);
          },
        ),
      ),
    );
  }
}

/// The cover: back and share, the status and "featured", the name and the
/// place — nothing else (the owner asked for a calm top).
class _Hero extends StatefulWidget {
  const _Hero({required this.page});
  final ProjectPage page;

  @override
  State<_Hero> createState() => _HeroState();
}

class _HeroState extends State<_Hero> {
  int _i = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final p = widget.page;
    final lang = Localizations.localeOf(context).languageCode;
    final top = MediaQuery.paddingOf(context).top;
    final statusColor = p.status == 'PUBLISHED' ? catalogAvailable : const Color(0xFF6B6256);
    final place = p.place();
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(32)),
      child: SizedBox(
        height: 290 + top,
        child: Stack(fit: StackFit.expand, children: [
          if (p.photos.length > 1)
            PageView(
              onPageChanged: (i) => setState(() => _i = i),
              children: [for (final u in p.photos) CatalogCover(url: u, height: 290 + top)],
            )
          else
            CatalogCover(url: p.photos.firstOrNull, height: 290 + top),
          const IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.center,
                  colors: [Color(0x660B1727), Colors.transparent],
                ),
              ),
            ),
          ),
          PositionedDirectional(
            top: top + 10,
            start: 14,
            end: 14,
            child: Row(children: [
              HomeHeroButton(
                icon: Icons.arrow_back_rounded, // mirrors to → in Arabic
                onTap: () => Navigator.of(context).maybePop(),
              ),
              const Spacer(),
              if (p.photos.length > 1)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(color: AppPalette.navy.withValues(alpha: 0.55), borderRadius: BorderRadius.circular(99)),
                  child: Text(l10n.ppPhotoOf(_i + 1, p.photos.length), style: const TextStyle(fontSize: 11, color: Colors.white)),
                ),
              const SizedBox(width: 8),
              HomeHeroButton(
                key: const Key('project-share'),
                icon: Icons.ios_share_rounded,
                onTap: () => StaffShare.project(projectId: p.id, projectName: p.name.resolve(lang), l10n: l10n),
              ),
            ]),
          ),
          PositionedDirectional(
            start: 16,
            end: 16,
            bottom: 46,
            child: IgnorePointer(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Wrap(spacing: 6, children: [
                  CatalogBadge.status(projectStatusLabel(l10n, p.status), statusColor,
                      icon: p.status == 'PUBLISHED' ? Icons.public_rounded : null),
                  if (p.featured) CatalogBadge.gold(l10n.cpFeatured, icon: Icons.star_rounded),
                ]),
                const SizedBox(height: 8),
                Text(p.name.resolve(lang), maxLines: 2, overflow: TextOverflow.ellipsis, style: homeDisplay(25, Colors.white)),
                if (place.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(children: [
                    const Icon(Icons.location_on_rounded, size: 15, color: AppPalette.gold300),
                    const SizedBox(width: 4),
                    Expanded(child: Text(place, style: const TextStyle(fontSize: 12.5, color: Color(0xFFDCE3EC)))),
                  ]),
                ],
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

/// The floating card: the occupancy ring, the starting price, how many
/// units are taken, and the units bar.
class _Occupancy extends StatelessWidget {
  const _Occupancy({required this.page});
  final ProjectPage page;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final pct = page.occupancy;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFEFE6D4)),
        boxShadow: const [BoxShadow(color: Color(0x290F1E33), blurRadius: 40, offset: Offset(0, 18))],
      ),
      child: Row(children: [
        _Ring(percent: pct, label: l10n.ppOccupancy),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(l10n.detailPricesFrom, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
            if (page.startingPrice != null)
              Text.rich(
                key: const Key('project-from'),
                TextSpan(children: [
                  TextSpan(text: ltr(catalogGrouped(page.startingPrice!)), style: homeDisplay(21, colors.inkStrong)),
                  TextSpan(text: ' ${PriceFormatter.symbol(lang)}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                ]),
              )
            else
              Text(l10n.priceOnRequest, style: homeDisplay(17, colors.inkMuted)),
            Text(l10n.ppTakenOf(page.taken, page.total), style: TextStyle(fontSize: 11, color: colors.inkMuted)),
            const SizedBox(height: 8),
            CatalogUnitsMix(available: page.available, reserved: page.reserved, sold: page.sold, other: page.other),
          ]),
        ),
      ]),
    );
  }
}

class _Ring extends StatelessWidget {
  const _Ring({required this.percent, required this.label});
  final int? percent;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return SizedBox(
      width: 84,
      height: 84,
      child: Stack(alignment: Alignment.center, children: [
        SizedBox.expand(
          child: CircularProgressIndicator(
            value: (percent ?? 0) / 100,
            strokeWidth: 8,
            strokeCap: StrokeCap.round,
            backgroundColor: colors.surfaceSoft,
            valueColor: const AlwaysStoppedAnimation(AppPalette.gold500),
          ),
        ),
        Column(mainAxisSize: MainAxisSize.min, children: [
          Text(percent == null ? '—' : ltr('$percent%'), key: const Key('project-occupancy'), style: homeDisplay(20, colors.inkStrong)),
          Text(label, style: TextStyle(fontSize: 10, color: colors.inkMuted)),
        ]),
      ]),
    );
  }
}

/// The facts (type, total area, licence), the description and the services.
class _About extends StatelessWidget {
  const _About({required this.page});
  final ProjectPage page;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final type = projectTypeLabel(l10n, page.type);
    final facts = <(String, String)>[
      if (type.isNotEmpty) (l10n.ppType, type),
      if (page.totalArea != null) (l10n.ppTotalArea, l10n.unitAreaValue(ltr(catalogGrouped(page.totalArea!)))),
      if ((page.license ?? '').isNotEmpty) (l10n.ppLicense, ltr(page.license!)),
    ];
    final desc = page.description?.resolve(lang) ?? '';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: homeCard(context),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (facts.isNotEmpty) ...[
          Wrap(spacing: 12, runSpacing: 10, children: [
            for (final (k, v) in facts)
              SizedBox(
                width: k == l10n.ppLicense ? double.infinity : 140,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(k, style: TextStyle(fontSize: 10.5, color: colors.inkMuted)),
                  Text(v, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                ]),
              ),
          ]),
          const SizedBox(height: 12),
          Divider(height: 1, color: colors.hairline),
          const SizedBox(height: 12),
        ],
        Text(desc.isEmpty ? l10n.ppNoDescription : desc,
            style: TextStyle(fontSize: 13, height: 1.85, color: desc.isEmpty ? colors.inkMuted : colors.ink)),
        if (page.services.isNotEmpty) ...[
          const SizedBox(height: 12),
          Divider(height: 1, color: colors.hairline),
          const SizedBox(height: 10),
          for (final s in page.services)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(color: AppPalette.gold50, borderRadius: BorderRadius.circular(9)),
                  child: const Icon(Icons.check_rounded, size: 16, color: AppPalette.gold500),
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(s, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: colors.inkStrong))),
              ]),
            ),
        ],
      ]),
    );
  }
}

/// Each phase with its delivery, and each building's floors, units, and
/// free and sold ones.
class _Phases extends StatelessWidget {
  const _Phases({required this.page});
  final ProjectPage page;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    if (page.phases.isEmpty) return _Note(l10n.ppNoPhases);
    return Column(children: [
      for (final (i, ph) in page.phases.indexed) ...[
        Container(
          key: Key('project-phase-${ph.id}'),
          padding: const EdgeInsets.all(14),
          decoration: homeCard(context),
          child: Column(children: [
            Row(children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(gradient: homeGoldGradient, borderRadius: BorderRadius.circular(13)),
                child: Text(ltr((i + 1).toString().padLeft(2, '0')), style: homeDisplay(16, AppPalette.navy)),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(ph.name, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                  Text('${l10n.ppBuildingsN(ph.buildings.length)} · ${l10n.cuCountN(ph.units)}',
                      style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                ]),
              ),
              if (ph.delivery != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(99)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.event_rounded, size: 14, color: colors.inkMuted),
                    const SizedBox(width: 4),
                    Text(l10n.ppDelivery(DateFormatter.monthYear(ph.delivery!, languageCode: lang)),
                        style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                  ]),
                ),
            ]),
            for (final b in ph.buildings) ...[
              const SizedBox(height: 10),
              Divider(height: 1, color: colors.hairline),
              const SizedBox(height: 10),
              Row(children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(color: AppPalette.gold50, borderRadius: BorderRadius.circular(11)),
                  child: const Icon(Icons.domain_rounded, size: 18, color: AppPalette.gold500),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(b.name, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                    Text([if (b.floors != null) l10n.ppFloorsN(b.floors!), l10n.cuCountN(b.units)].join(' · '),
                        style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                  ]),
                ),
                if (b.available != null)
                  Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text(l10n.ppAvailableN(b.available!),
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: catalogAvailable)),
                    Text(l10n.ppSoldN(b.sold ?? 0), style: TextStyle(fontSize: 10, color: colors.inkMuted)),
                  ]),
              ]),
            ],
          ]),
        ),
        if (i < page.phases.length - 1) const SizedBox(height: 10),
      ],
    ]);
  }
}

class _Note extends StatelessWidget {
  const _Note(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: homeCard(context),
        child: Text(text, style: TextStyle(fontSize: 12.5, color: context.appColors.inkMuted)),
      );
}

/// Share with a client, and add an interested client to this project.
class _Bar extends StatelessWidget {
  const _Bar({required this.page});
  final ProjectPage page;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(color: colors.canvas, border: Border(top: BorderSide(color: colors.hairline))),
      child: Row(children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => StaffShare.project(projectId: page.id, projectName: page.name.resolve(lang), l10n: l10n),
            icon: const Icon(Icons.ios_share_rounded, size: 18),
            label: Text(l10n.staffShareWithClient),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(46),
              foregroundColor: AppPalette.navy,
              side: const BorderSide(color: AppPalette.navy, width: 1.5),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: FilledButton.icon(
            key: const Key('project-add-lead'),
            onPressed: () => context.push(
              '/leads/new',
              extra: LeadInterestContext(projectId: page.id, projectName: page.name.resolve(lang)),
            ),
            icon: const Icon(Icons.person_add_rounded, size: 18),
            label: Text(l10n.staffAddInterestedClient),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(46),
              backgroundColor: AppPalette.gold400,
              foregroundColor: AppPalette.navy,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
            ),
          ),
        ),
      ]),
    );
  }
}
