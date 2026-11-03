import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../../../common/catalog_status_label.dart';
import '../../domain/entities/broker_project.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);
const _navyLight = Color(0xFF243F62);

class BrokerUnitDetailScreen extends StatefulWidget {
  const BrokerUnitDetailScreen({super.key, required this.unit, this.projectId});

  final BrokerUnit unit;
  final String? projectId;

  @override
  State<BrokerUnitDetailScreen> createState() => _BrokerUnitDetailScreenState();
}

class _BrokerUnitDetailScreenState extends State<BrokerUnitDetailScreen> {
  final _detailsKey = GlobalKey();
  final _planKey = GlobalKey();
  final _locationKey = GlobalKey();
  final _projectKey = GlobalKey();

  @override
  Widget build(BuildContext context) {
    final unit = widget.unit;
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final available = unit.status.toUpperCase() == 'AVAILABLE';
    final effProjectId = widget.projectId ?? unit.projectId;
    final hasPrice = unit.price != null && unit.price!.isNotEmpty;
    final projectName = lang == 'ar' ? (unit.projectNameAr ?? unit.projectNameEn) : (unit.projectNameEn ?? unit.projectNameAr);
    final hasSpecs = _hasSpecs(unit);
    final hasLocation = unit.hasLocation || unit.address != null;

    Widget section(String title, {Key? key}) => SliverToBoxAdapter(
          child: Padding(
            key: key,
            padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.xl, AppSpacing.lg, AppSpacing.md),
            child: _SectionTitle(title),
          ),
        );
    Widget box(Widget child) => SliverToBoxAdapter(
          child: Padding(padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg), child: child),
        );

    return AppDetailPage(
      onBack: () => context.pop(),
      title: ltr(unit.code),
      subtitle: [
        if (unit.type != null) unitTypeLabel(unit.type, languageCode: lang),
        ?projectName,
      ].join(' · '),
      photos: unit.allImageUrls,
      photoPlaceholder: _NavyFallback(),
      photoBadge: StatusBadge(label: unitStatusLabel(l10n, unit.status), tone: unitStatusTone(unit.status)),
      bottomBar: available
          ? AppDetailBottomBar(
              children: [
                AppDetailPrimaryButton(
                  key: const Key('broker-unit-add-lead'),
                  label: l10n.brokerLeadNew,
                  icon: Icons.person_add_alt_1_rounded,
                  onPressed: () => context.push('/broker/leads/new', extra: {
                    'projectId': ?effProjectId,
                    'unitId': unit.id,
                  }),
                ),
              ],
            )
          : null,
      slivers: [
        AppDetailPage.box(
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.md),
            child: AppPriceCard(
              label: l10n.detailTotalPrice,
              price: hasPrice ? PriceFormatter.formatString(unit.price, languageCode: lang) : l10n.priceOnRequest,
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.md)),
        AppSectionTabsSliver(
          tabs: [
            if (hasSpecs) AppSectionTab(l10n.detailTabOverview, _detailsKey),
            if (unit.floorPlanUrls.isNotEmpty) AppSectionTab(l10n.detailTabFloorPlan, _planKey),
            if (hasLocation) AppSectionTab(l10n.detailTabLocation, _locationKey),
            if (unit.projectId != null) AppSectionTab(l10n.navProjects, _projectKey),
          ],
        ),

        // ── Unit details ─────────────────────────────────────────────
        if (hasSpecs) ...[
          section(l10n.unitDetails, key: _detailsKey),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            sliver: _SpecsGrid(unit: unit, l10n: l10n),
          ),
        ],

        // ── Floor plans ──────────────────────────────────────────────
        if (unit.floorPlanUrls.isNotEmpty) ...[
          section(l10n.sectionFloorPlans, key: _planKey),
          box(_MediaGallery(urls: unit.floorPlanUrls)),
        ],

        // ── Location ─────────────────────────────────────────────────
        if (hasLocation) ...[
          section(l10n.projectLocation, key: _locationKey),
          box(_LocationCard(unit: unit, l10n: l10n)),
        ],

        // ── Project ──────────────────────────────────────────────────
        if (unit.projectId != null) ...[
          section(l10n.navProjects, key: _projectKey),
          box(_ProjectCard(unit: unit, lang: lang)),
        ],
      ],
    );
  }

  bool _hasSpecs(BrokerUnit u) => u.bedrooms != null || u.bathrooms != null || u.area != null || u.floor != null;
}

// ── Hero background ───────────────────────────────────────────────────────────

class _NavyFallback extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [_navyLight, _navyMid, _navyDeep],
              stops: [0.0, 0.45, 1.0],
            ),
          ),
        ),
        const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
        PositionedDirectional(
          end: 0,
          top: 0,
          child: Container(
            width: 200,
            height: 200,
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.topRight,
                radius: 1.0,
                colors: [
                  AppPalette.gold400.withValues(alpha: 0.14),
                  AppPalette.gold400.withValues(alpha: 0.0),
                ],
              ),
            ),
          ),
        ),
        Center(
          child: Icon(
            Icons.apartment_rounded,
            size: 80,
            color: Colors.white.withValues(alpha: 0.12),
          ),
        ),
      ],
    );
  }
}

// ── Meta strip ────────────────────────────────────────────────────────────────

// ── Add lead CTA card ─────────────────────────────────────────────────────────

// ── Section title ─────────────────────────────────────────────────────────────

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    return AppDetailSectionTitle(title);
  }
}

// ── Specs grid ────────────────────────────────────────────────────────────────

class _SpecsGrid extends StatelessWidget {
  const _SpecsGrid({required this.unit, required this.l10n});
  final BrokerUnit unit;
  final AppLocalizations l10n;

  static String _fmtArea(String? raw) {
    final n = num.tryParse(raw ?? '');
    if (n == null) return raw ?? '';
    return n == n.truncateToDouble()
        ? n.toInt().toString()
        : n.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    final specs = <(IconData, String, String)>[
      if (unit.bedrooms != null)
        (Icons.bed_outlined, '${unit.bedrooms}', l10n.unitBedrooms),
      if (unit.bathrooms != null)
        (Icons.bathtub_outlined, '${unit.bathrooms}', l10n.unitBathrooms),
      if (unit.area != null)
        (Icons.square_foot_outlined, l10n.unitAreaValue(_fmtArea(unit.area)),
            l10n.unitArea),
      if (unit.floor != null)
        (Icons.layers_outlined, '${unit.floor}', l10n.unitFloor),
    ];

    if (specs.isEmpty) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }

    return SliverToBoxAdapter(
      child: AppDetailStatsRow(
        stats: [for (final x in specs) AppDetailStat(icon: x.$1, value: x.$2, label: x.$3)],
      ),
    );
  }
}

// ── Media gallery ─────────────────────────────────────────────────────────────

class _MediaGallery extends StatefulWidget {
  const _MediaGallery({required this.urls});
  final List<String> urls;

  @override
  State<_MediaGallery> createState() => _MediaGalleryState();
}

class _MediaGalleryState extends State<_MediaGallery> {
  final _ctrl = PageController();
  int _page = 0;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final multi = widget.urls.length > 1;

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      child: Container(
        height: 240,
        decoration: BoxDecoration(
          color: colors.surfaceSoft,
          border:
              Border.all(color: colors.hairline.withValues(alpha: 0.5)),
        ),
        child: Stack(
          children: [
            PageView.builder(
              controller: _ctrl,
              itemCount: widget.urls.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (_, i) => AppNetworkImage(url: widget.urls[i]),
            ),
            if (multi)
              PositionedDirectional(
                top: AppSpacing.sm,
                end: AppSpacing.sm,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.50),
                    borderRadius: AppRadii.pillAll,
                  ),
                  child: Text(
                    '${_page + 1} / ${widget.urls.length}',
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Colors.white),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Location card ─────────────────────────────────────────────────────────────

class _LocationCard extends StatelessWidget {
  const _LocationCard({required this.unit, required this.l10n});
  final BrokerUnit unit;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final hasMap = unit.hasLocation;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (unit.address != null) ...[
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg, vertical: AppSpacing.md),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: hasMap
                  ? const BorderRadius.only(
                      topLeft: Radius.circular(AppRadii.lg),
                      topRight: Radius.circular(AppRadii.lg),
                    )
                  : BorderRadius.circular(AppRadii.lg),
              border: Border.all(color: colors.hairline),
            ),
            child: Row(
              children: [
                Icon(Icons.location_on_rounded,
                    size: 18, color: colors.brandGold),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    unit.address!,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: colors.inkStrong,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (hasMap) const SizedBox(height: 2),
        ],
        if (hasMap)
          ClipRRect(
            borderRadius: unit.address != null
                ? const BorderRadius.only(
                    bottomLeft: Radius.circular(AppRadii.lg),
                    bottomRight: Radius.circular(AppRadii.lg),
                  )
                : BorderRadius.circular(AppRadii.lg),
            child: SizedBox(
              height: 220,
              child: Stack(
                children: [
                  FlutterMap(
                    options: MapOptions(
                      initialCenter:
                          LatLng(unit.latitude!, unit.longitude!),
                      initialZoom: 15,
                      interactionOptions: const InteractionOptions(
                        flags: InteractiveFlag.pinchZoom |
                            InteractiveFlag.doubleTapZoom,
                      ),
                    ),
                    children: [
                      TileLayer(
                        urlTemplate:
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'com.devora.staff',
                        maxZoom: 19,
                      ),
                      MarkerLayer(markers: [
                        Marker(
                          point:
                              LatLng(unit.latitude!, unit.longitude!),
                          width: 48,
                          height: 48,
                          child: const _UnitMapPin(),
                        ),
                      ]),
                    ],
                  ),
                  PositionedDirectional(
                    bottom: AppSpacing.sm,
                    end: AppSpacing.sm,
                    child: GestureDetector(
                      onTap: () => ContactActions.openMap(
                        lat: unit.latitude!,
                        lng: unit.longitude!,
                        label: unit.address ?? unit.code,
                      ),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: _navyDeep.withValues(alpha: 0.88),
                          borderRadius: AppRadii.pillAll,
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.20),
                              width: 0.8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.open_in_new_rounded,
                                size: 13, color: Colors.white70),
                            const SizedBox(width: 5),
                            Text(
                              l10n.openInMaps,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _UnitMapPin extends StatelessWidget {
  const _UnitMapPin();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: AppPalette.gold400,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: [
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.5),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: const Icon(Icons.home_rounded,
              size: 16, color: Colors.white),
        ),
        Container(width: 2, height: 10, color: AppPalette.gold500),
      ],
    );
  }
}

// ── Project card ──────────────────────────────────────────────────────────────

class _ProjectCard extends StatelessWidget {
  const _ProjectCard({required this.unit, required this.lang});
  final BrokerUnit unit;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final name = unit.projectName(lang);
    final city = unit.projectCity;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
            color: AppPalette.gold400.withValues(alpha: 0.20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppPalette.gold300, AppPalette.gold500],
              ),
              borderRadius: BorderRadius.circular(AppRadii.md + 2),
            ),
            child: const Icon(Icons.apartment_rounded,
                color: Colors.white, size: 26),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (name != null) ...[
                  Text(
                    name,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: colors.inkStrong,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                ],
                if (city != null)
                  Row(
                    children: [
                      Icon(Icons.location_on_rounded,
                          size: 13, color: colors.brandGold),
                      const SizedBox(width: 3),
                      Flexible(
                        child: Text(
                          city,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: colors.inkMuted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          Icon(Icons.arrow_back_ios_new_rounded,
              size: 14, color: colors.inkMuted),
        ],
      ),
    );
  }
}

// ── Status pill ───────────────────────────────────────────────────────────────

// ── Circle back button ────────────────────────────────────────────────────────

// ── Dot texture ───────────────────────────────────────────────────────────────

class _DotTexture extends StatelessWidget {
  const _DotTexture();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
