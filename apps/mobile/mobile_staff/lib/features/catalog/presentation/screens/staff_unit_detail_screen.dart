import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../../common/catalog_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../../../common/staff_share.dart';
import '../../../installments/domain/repositories/installments_repository.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_unit_detail_cubit.dart';

const _navyDeep  = Color(0xFF0B1726);
const _navyMid   = Color(0xFF14273F);
const _navyLight = Color(0xFF243F62);

// ══════════════════════════════════════════════════════════════════════════════
// Root
// ══════════════════════════════════════════════════════════════════════════════
class StaffUnitDetailScreen extends StatefulWidget {
  const StaffUnitDetailScreen({super.key, this.projectId});
  final String? projectId;

  @override
  State<StaffUnitDetailScreen> createState() => _StaffUnitDetailScreenState();
}

class _StaffUnitDetailScreenState extends State<StaffUnitDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<StaffUnitDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<StaffUnitDetailCubit, StaffUnitDetailState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return _LoadingScaffold();
          case DataStatus.failure:
            return _ErrorScaffold(
              failure: state.failure,
              onRetry: () => context.read<StaffUnitDetailCubit>().load(),
            );
          case DataStatus.empty:
          case DataStatus.success:
            return _DetailPage(unit: state.data!, projectId: widget.projectId);
        }
      },
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Loading scaffold
// ══════════════════════════════════════════════════════════════════════════════
class _LoadingScaffold extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _navyDeep,
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: const NavHeaderBack(),
                ),
              ),
              const Expanded(child: StaffListSkeleton()),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Error scaffold
// ══════════════════════════════════════════════════════════════════════════════
class _ErrorScaffold extends StatelessWidget {
  const _ErrorScaffold({required this.failure, required this.onRetry});
  final dynamic failure;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        appBar: AppBar(
          backgroundColor: _navyDeep,
          automaticallyImplyLeading: false,
          leading: Padding(
            padding: const EdgeInsets.all(8),
            child: const NavHeaderBack(),
          ),
        ),
        body: ErrorState(failure: failure, onRetry: onRetry),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Detail page
// ══════════════════════════════════════════════════════════════════════════════
class _DetailPage extends StatefulWidget {
  const _DetailPage({required this.unit, this.projectId});
  final StaffUnit unit;
  final String? projectId;

  @override
  State<_DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<_DetailPage> {
  final _detailsKey = GlobalKey();
  final _planKey = GlobalKey();
  final _paymentKey = GlobalKey();
  final _locationKey = GlobalKey();
  List<InstallmentOffer> _offers = const [];

  StaffUnit get unit => widget.unit;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  // Best-effort: the page shows without them.
  Future<void> _loadPlans() async {
    final projectId = widget.projectId ?? unit.projectId;
    if (projectId == null) return;
    final result = await context.read<InstallmentsRepository>().unitOffers(projectId: projectId, unitId: unit.id);
    if (!mounted) return;
    if (result case Ok(:final data)) setState(() => _offers = data);
  }

  List<String> get _photos {
    final seen = <String>{};
    return [
      if (unit.coverImage != null) unit.coverImage!,
      ...unit.mediaUrls,
    ].where(seen.add).toList();
  }

  void _openCalculator() {
    final lang = Localizations.localeOf(context).languageCode;
    if (_offers.every((o) => o.options.isEmpty)) {
      _openFullCalculator();
      return;
    }
    showInstallmentCalculator(
      context,
      subtitle: [
        ltr(unit.code),
        if (unit.price != null) PriceFormatter.formatString(unit.price, languageCode: lang),
      ].join(' · '),
      offers: _offers,
      actions: (sheetContext) => [
        AppDetailSecondaryButton(
          label: context.l10n.staffShareWithClient,
          icon: Icons.ios_share_rounded,
          onPressed: () {
            Navigator.of(sheetContext).pop();
            _share();
          },
        ),
      ],
    );
  }

  void _openFullCalculator() => context.push(
        '/calculator',
        extra: {'price': double.tryParse(unit.price ?? ''), 'projectId': unit.projectId},
      );

  void _share() {
    final lang = Localizations.localeOf(context).languageCode;
    StaffShare.unit(
      unitId: unit.id,
      unitCode: unit.code,
      projectName: unit.projectName?.resolve(lang) ?? '',
      l10n: context.l10n,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final hasProject = unit.projectName != null || unit.projectCity != null;
    final available = unit.status == 'AVAILABLE';
    final hasPrice = unit.price != null && unit.price!.isNotEmpty;
    final price = hasPrice ? PriceFormatter.formatString(unit.price, languageCode: lang) : l10n.priceOnRequest;
    final monthlyLine = cheapestInstallmentLine(l10n, lang, _offers);
    final offer = _offers.where((o) => o.options.isNotEmpty).firstOrNull;
    final longest = offer?.longest;
    final handover = unit.specs.deliveryDate;
    final hasLocation = unit.hasLocation || unit.address != null;

    Widget section(String title, {Key? key}) => AppDetailPage.box(
          Padding(
            key: key,
            padding: const EdgeInsets.only(top: AppSpacing.xl, bottom: AppSpacing.md),
            child: AppDetailSectionTitle(title),
          ),
        );

    return AppDetailPage(
      onBack: () => context.pop(),
      title: ltr(unit.code),
      subtitle: [
        if (unit.type != null) unit.typeLabel(lang),
        if (unit.projectName != null) unit.projectName!.resolve(lang),
      ].join(' · '),
      photos: _photos,
      photoPlaceholder: _Placeholder(),
      photoBadge: StatusBadge(label: unitStatusLabel(l10n, unit.status), tone: unitStatusTone(unit.status)),
      bottomBar: AppDetailBottomBar(
        children: [
          AppDetailSecondaryButton(
            key: const Key('unit-calculator'),
            label: l10n.calculatorTitle,
            onPressed: _openFullCalculator,
          ),
          AppDetailSecondaryButton(
            key: const Key('unit-share'),
            label: l10n.staffShareWithClient,
            onPressed: _share,
          ),
          if (available)
            AppDetailPrimaryButton(
              key: const Key('unit-reserve'),
              label: l10n.reservationCreate,
              onPressed: () => context.push(
                '/reservations/new',
                extra: {'unitId': unit.id, if (unit.projectId != null) 'projectId': unit.projectId},
              ),
            ),
        ],
      ),
      slivers: [
        AppDetailPage.box(
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.md),
            child: AppPriceCard(
              label: l10n.detailTotalPrice,
              price: price,
              caption: monthlyLine,
              facts: [
                if (offer != null)
                  AppPriceFact(
                    l10n.detailUpfrontPct(offer.downPaymentPercentLabel),
                    PriceFormatter.format(offer.downPayment.round(), languageCode: lang),
                  ),
                if (longest != null) AppPriceFact(l10n.detailTerm, durationText(l10n, longest.durationMonths)),
                if (handover != null) AppPriceFact(l10n.detailHandover, '${handover.year}'),
              ],
              actionLabel: hasPrice ? l10n.detailCalcInstallment : null,
              onAction: hasPrice ? _openCalculator : null,
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.md)),
        AppSectionTabsSliver(
          tabs: [
            AppSectionTab(l10n.detailTabOverview, _detailsKey),
            if (unit.floorPlanUrls.isNotEmpty) AppSectionTab(l10n.detailTabFloorPlan, _planKey),
            if (_offers.isNotEmpty) AppSectionTab(l10n.detailTabPayment, _paymentKey),
            if (hasLocation) AppSectionTab(l10n.detailTabLocation, _locationKey),
          ],
        ),

        // ── Unit details ────────────────────────────────────────────────
        section(l10n.unitDetails, key: _detailsKey),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          sliver: _SpecsGrid(unit: unit, l10n: l10n),
        ),
        // EE2/EE5 — the specs the website shows (only those it has).
        if (!unit.specs.isEmpty)
          AppDetailPage.box(
            Padding(padding: const EdgeInsets.only(top: AppSpacing.sm), child: UnitSpecsGrid(specs: unit.specs)),
          ),

        // ── Floor plans ─────────────────────────────────────────────────
        if (unit.floorPlanUrls.isNotEmpty) ...[
          section(l10n.sectionFloorPlans, key: _planKey),
          AppDetailPage.box(_UnitFloorPlansGallery(urls: unit.floorPlanUrls)),
        ],

        // ── Payment plans ───────────────────────────────────────────────
        if (_offers.isNotEmpty) ...[
          section(l10n.detailTabPayment, key: _paymentKey),
          for (final o in _offers)
            AppDetailPage.box(
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                      child: Text(o.name, style: Theme.of(context).textTheme.titleSmall),
                    ),
                    AppPaymentPlanTable(offer: o),
                  ],
                ),
              ),
            ),
        ],

        // ── Location ────────────────────────────────────────────────────
        if (hasLocation) ...[
          section(l10n.projectLocation, key: _locationKey),
          AppDetailPage.box(_UnitLocationCard(unit: unit, l10n: l10n)),
        ],

        // ── Maintenance & warranty ──────────────────────────────────────
        if (unit.maintenanceItems.isNotEmpty) ...[
          section(l10n.sectionWarrantyItems),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            sliver: SliverList.separated(
              itemCount: unit.maintenanceItems.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
              itemBuilder: (_, i) => _MaintenanceItemCard(item: unit.maintenanceItems[i], l10n: l10n, lang: lang),
            ),
          ),
        ],

        // ── Project ─────────────────────────────────────────────────────
        if (hasProject) ...[
          section(l10n.navProjects),
          AppDetailPage.box(_ProjectCard(unit: unit, lang: lang)),
        ],
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Hero background
// ══════════════════════════════════════════════════════════════════════════════
class _Placeholder extends StatelessWidget {
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
            width: 220,
            height: 220,
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
            size: 88,
            color: Colors.white.withValues(alpha: 0.12),
          ),
        ),
      ],
    );
  }
}

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

// ══════════════════════════════════════════════════════════════════════════════
// Glass circle back button
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// Meta strip — edge-to-edge: type chip + price + status badge
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// Section title
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// Specs — 2 × 2 grid (ensures enough height for scrolling)
// ══════════════════════════════════════════════════════════════════════════════
class _SpecsGrid extends StatelessWidget {
  const _SpecsGrid({required this.unit, required this.l10n});
  final StaffUnit unit;
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
        (
          Icons.square_foot_outlined,
          l10n.unitAreaValue(_fmtArea(unit.area)),
          l10n.unitArea,
        ),
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

// ══════════════════════════════════════════════════════════════════════════════
// Project card
// ══════════════════════════════════════════════════════════════════════════════
class _ProjectCard extends StatelessWidget {
  const _ProjectCard({required this.unit, required this.lang});
  final StaffUnit unit;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final name = unit.projectName?.resolve(lang);
    final city = unit.projectCity;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: AppPalette.gold400.withValues(alpha: 0.20)),
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
            child: const Icon(
              Icons.apartment_rounded,
              color: Colors.white,
              size: 26,
            ),
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
                      Icon(
                        Icons.location_on_rounded,
                        size: 13,
                        color: colors.brandGold,
                      ),
                      const SizedBox(width: 3),
                      Flexible(
                        child: Text(
                          city,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colors.inkMuted,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          Icon(
            Icons.arrow_back_ios_new_rounded,
            size: 14,
            color: colors.inkMuted,
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Sticky action dock
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// Unit location — inline map (when coordinates exist) with address row above,
// or address-only card when coordinates are absent
// ══════════════════════════════════════════════════════════════════════════════
class _UnitLocationCard extends StatelessWidget {
  const _UnitLocationCard({required this.unit, required this.l10n});
  final StaffUnit unit;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final hasMap = unit.hasLocation;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Address row (shown when address is present)
        if (unit.address != null) ...[
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
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
                Icon(
                  Icons.location_on_rounded,
                  size: 18,
                  color: colors.brandGold,
                ),
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
        // In-app map
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
                      initialCenter: LatLng(unit.latitude!, unit.longitude!),
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
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: LatLng(unit.latitude!, unit.longitude!),
                            width: 48,
                            height: 48,
                            child: const _UnitMapPin(),
                          ),
                        ],
                      ),
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
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: _navyDeep.withValues(alpha: 0.88),
                          borderRadius: AppRadii.pillAll,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.20),
                            width: 0.8,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.open_in_new_rounded,
                              size: 13,
                              color: Colors.white70,
                            ),
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
          child: const Icon(
            Icons.home_rounded,
            size: 16,
            color: Colors.white,
          ),
        ),
        Container(
          width: 2,
          height: 10,
          color: AppPalette.gold500,
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Floor plans gallery (unit)
// ══════════════════════════════════════════════════════════════════════════════
class _UnitFloorPlansGallery extends StatefulWidget {
  const _UnitFloorPlansGallery({required this.urls});
  final List<String> urls;

  @override
  State<_UnitFloorPlansGallery> createState() => _UnitFloorPlansGalleryState();
}

class _UnitFloorPlansGalleryState extends State<_UnitFloorPlansGallery> {
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
          border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
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
            if (multi) ...[
              Positioned(
                left: 6,
                top: 0,
                bottom: 0,
                child: Center(
                  child: _FpArrowBtn(
                    icon: Icons.chevron_left_rounded,
                    onTap: _page > 0
                        ? () => _ctrl.previousPage(
                              duration: const Duration(milliseconds: 220),
                              curve: Curves.easeOutCubic,
                            )
                        : null,
                  ),
                ),
              ),
              Positioned(
                right: 6,
                top: 0,
                bottom: 0,
                child: Center(
                  child: _FpArrowBtn(
                    icon: Icons.chevron_right_rounded,
                    onTap: _page < widget.urls.length - 1
                        ? () => _ctrl.nextPage(
                              duration: const Duration(milliseconds: 220),
                              curve: Curves.easeOutCubic,
                            )
                        : null,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _FpArrowBtn extends StatelessWidget {
  const _FpArrowBtn({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: enabled ? 0.45 : 0.20),
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          size: 20,
          color: Colors.white.withValues(alpha: enabled ? 1.0 : 0.35),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Maintenance / warranty item card
// ══════════════════════════════════════════════════════════════════════════════
class _MaintenanceItemCard extends StatelessWidget {
  const _MaintenanceItemCard({
    required this.item,
    required this.l10n,
    required this.lang,
  });

  final StaffMaintenanceItem item;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final name = item.name.resolve(lang);
    final category = item.categoryName?.resolve(lang);
    final active = item.isUnderWarranty;
    final hasWarranty = item.hasWarrantyDates;

    final warrantyColor = hasWarranty
        ? (active ? colors.success : colors.inkMuted)
        : colors.inkMuted;
    final warrantyLabel = hasWarranty
        ? (active ? l10n.warrantyActive : l10n.warrantyExpired)
        : null;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row: icon + name + warranty badge
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppPalette.gold400.withValues(alpha: 0.10),
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: AppPalette.gold400.withValues(alpha: 0.20)),
                ),
                child: const Icon(Icons.build_outlined,
                    size: 18, color: AppPalette.gold500),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (category != null)
                      Text(
                        category,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: colors.inkMuted,
                          letterSpacing: 0.3,
                        ),
                      ),
                    Text(
                      name,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: colors.inkStrong,
                      ),
                    ),
                  ],
                ),
              ),
              if (warrantyLabel != null) ...[
                const SizedBox(width: AppSpacing.xs),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: warrantyColor.withValues(alpha: 0.10),
                    borderRadius: AppRadii.pillAll,
                    border: Border.all(
                        color: warrantyColor.withValues(alpha: 0.35)),
                  ),
                  child: Text(
                    warrantyLabel,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: warrantyColor,
                    ),
                  ),
                ),
              ],
            ],
          ),

          // Warranty date range
          if (hasWarranty) ...[
            const SizedBox(height: AppSpacing.sm),
            Divider(height: 1, thickness: 0.5, color: colors.hairline),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Icon(Icons.calendar_today_outlined,
                    size: 13, color: colors.inkMuted),
                const SizedBox(width: 5),
                Text(
                  '${_fmtDate(item.warrantyStart!)} — ${_fmtDate(item.warrantyEnd!)}',
                  style: TextStyle(fontSize: 12, color: colors.inkMuted),
                ),
              ],
            ),
          ],

          // Supplier / contractor
          if (item.supplierName != null || item.contractorName != null) ...[
            const SizedBox(height: AppSpacing.xs),
            if (item.supplierName != null)
              _MetaRow(
                icon: Icons.storefront_outlined,
                label: l10n.labelSupplier,
                value: item.supplierName!,
              ),
            if (item.contractorName != null)
              _MetaRow(
                icon: Icons.engineering_outlined,
                label: l10n.labelContractor,
                value: item.contractorName!,
              ),
          ],
        ],
      ),
    );
  }

  static String _fmtDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(icon, size: 13, color: colors.inkMuted),
          const SizedBox(width: 5),
          Text(
            '$label: ',
            style: TextStyle(
                fontSize: 12,
                color: colors.inkMuted,
                fontWeight: FontWeight.w500),
          ),
          Flexible(
            child: Text(
              value,
              style: TextStyle(
                  fontSize: 12,
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w600),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
