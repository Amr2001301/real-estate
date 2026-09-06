import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../../../common/catalog_status_label.dart';
import '../../domain/entities/broker_project.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);
const _navyLight = Color(0xFF243F62);

class BrokerUnitDetailScreen extends StatelessWidget {
  const BrokerUnitDetailScreen(
      {super.key, required this.unit, this.projectId});

  final BrokerUnit unit;
  final String? projectId;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final available = unit.status.toUpperCase() == 'AVAILABLE';
    final effProjectId = projectId ?? unit.projectId;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light
          .copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: CustomScrollView(
          physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics()),
          slivers: [
            // ── Collapsing hero ──────────────────────────────────────────
            SliverAppBar(
              expandedHeight: 320,
              pinned: true,
              stretch: true,
              backgroundColor: _navyDeep,
              surfaceTintColor: Colors.transparent,
              systemOverlayStyle: SystemUiOverlayStyle.light,
              automaticallyImplyLeading: false,
              leading: Padding(
                padding: const EdgeInsets.all(8),
                child: _CircleBackButton(onTap: () => context.pop()),
              ),
              flexibleSpace: FlexibleSpaceBar(
                collapseMode: CollapseMode.parallax,
                stretchModes: const [StretchMode.zoomBackground],
                titlePadding: const EdgeInsetsDirectional.fromSTEB(
                    AppSpacing.xl, 0, AppSpacing.lg, AppSpacing.md),
                title: Text(
                  unit.code,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: 0.5,
                    shadows: [Shadow(color: Colors.black54, blurRadius: 10)],
                  ),
                ),
                background: _HeroBackground(unit: unit, l10n: l10n),
              ),
            ),

            // ── Meta strip ────────────────────────────────────────────────
            SliverToBoxAdapter(child: _MetaStrip(unit: unit, l10n: l10n, lang: lang)),

            // ── Add lead CTA card (AVAILABLE only) ────────────────────────
            if (available)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
                  child: _AddLeadCard(
                      projectId: effProjectId, unitId: unit.id, l10n: l10n),
                ),
              ),

            // ── Unit details ─────────────────────────────────────────────
            if (_hasSpecs(unit)) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.lg,
                      AppSpacing.xl, AppSpacing.lg, AppSpacing.md),
                  child: _SectionTitle(l10n.unitDetails),
                ),
              ),
              SliverPadding(
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                sliver: _SpecsGrid(unit: unit, l10n: l10n),
              ),
            ],

            // ── Floor plans ──────────────────────────────────────────────
            if (unit.floorPlanUrls.isNotEmpty) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.lg,
                      AppSpacing.xl, AppSpacing.lg, AppSpacing.md),
                  child: _SectionTitle(l10n.sectionFloorPlans),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg),
                  child: _MediaGallery(urls: unit.floorPlanUrls),
                ),
              ),
            ],

            // ── Location ─────────────────────────────────────────────────
            if (unit.hasLocation || unit.address != null) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.lg,
                      AppSpacing.xl, AppSpacing.lg, AppSpacing.md),
                  child: _SectionTitle(l10n.projectLocation),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg),
                  child: _LocationCard(unit: unit, l10n: l10n),
                ),
              ),
            ],

            // ── Project ──────────────────────────────────────────────────
            if (unit.projectId != null) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.lg,
                      AppSpacing.xl, AppSpacing.lg, AppSpacing.md),
                  child: _SectionTitle(l10n.navProjects),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg),
                  child: _ProjectCard(unit: unit, lang: lang),
                ),
              ),
            ],

            const SliverToBoxAdapter(child: SizedBox(height: 56)),
          ],
        ),
      ),
    );
  }

  bool _hasSpecs(BrokerUnit u) =>
      u.bedrooms != null ||
      u.bathrooms != null ||
      u.area != null ||
      u.floor != null;
}

// ── Hero background ───────────────────────────────────────────────────────────

class _HeroBackground extends StatefulWidget {
  const _HeroBackground({required this.unit, required this.l10n});
  final BrokerUnit unit;
  final AppLocalizations l10n;

  @override
  State<_HeroBackground> createState() => _HeroBackgroundState();
}

class _HeroBackgroundState extends State<_HeroBackground> {
  final _ctrl = PageController();
  int _page = 0;

  List<String> get _urls => widget.unit.allImageUrls;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final urls = _urls;
    final multi = urls.length > 1;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Image carousel or navy-gradient fallback
        if (urls.isEmpty)
          _NavyFallback()
        else if (!multi)
          AppNetworkImage(url: urls.first)
        else
          PageView.builder(
            controller: _ctrl,
            onPageChanged: (i) => setState(() => _page = i),
            itemCount: urls.length,
            itemBuilder: (_, i) => AppNetworkImage(url: urls[i]),
          ),

        // Top gradient — protects back button
        const Positioned(
          top: 0, left: 0, right: 0, height: 130,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xCC000000), Color(0x00000000)],
                ),
              ),
            ),
          ),
        ),

        // Bottom gradient — behind title
        const Positioned(
          left: 0, right: 0, bottom: 0, height: 180,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Color(0xF2050E18), Color(0x00000000)],
                ),
              ),
            ),
          ),
        ),

        // Gold hairline at the very bottom
        const Positioned(
          bottom: 0, left: 0, right: 0,
          child: SizedBox(
            height: 1.5,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.transparent,
                    Color(0x66C8A24B),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
        ),

        // Page dots
        if (multi)
          Positioned(
            bottom: 88,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: _PageDots(count: urls.length, current: _page),
            ),
          ),

        // Status + media count badges — top end
        PositionedDirectional(
          top: kToolbarHeight + 8,
          end: AppSpacing.lg,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (multi) ...[
                _CountPill(current: _page + 1, total: urls.length),
                const SizedBox(width: AppSpacing.xs),
              ],
              _StatusPill(
                label: unitStatusLabel(widget.l10n, widget.unit.status),
                tone: unitStatusTone(widget.unit.status),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

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

class _PageDots extends StatelessWidget {
  const _PageDots({required this.count, required this.current});
  final int count;
  final int current;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (int i = 0; i < count; i++) ...[
          if (i > 0) const SizedBox(width: 5),
          AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            width: current == i ? 20 : 6,
            height: 6,
            decoration: BoxDecoration(
              color: current == i
                  ? Colors.white
                  : Colors.white.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(3),
            ),
          ),
        ],
      ],
    );
  }
}

class _CountPill extends StatelessWidget {
  const _CountPill({required this.current, required this.total});
  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.45),
        borderRadius: AppRadii.pillAll,
        border: Border.all(
            color: Colors.white.withValues(alpha: 0.28), width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.photo_library_outlined,
              size: 12, color: Colors.white70),
          const SizedBox(width: 4),
          Text('$current / $total',
              style:
                  const TextStyle(fontSize: 11, color: Colors.white70)),
        ],
      ),
    );
  }
}

// ── Meta strip ────────────────────────────────────────────────────────────────

class _MetaStrip extends StatelessWidget {
  const _MetaStrip(
      {required this.unit, required this.l10n, required this.lang});
  final BrokerUnit unit;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final hasPrice = unit.price != null && unit.price!.isNotEmpty;
    final available = unit.status.toUpperCase() == 'AVAILABLE';

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        child: Row(
          children: [
            // Type chip
            if (unit.type != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: _navyLight.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  border: Border.all(
                      color: _navyLight.withValues(alpha: 0.18)),
                ),
                child: Text(
                  unit.type!,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: _navyMid,
                  ),
                ),
              ),
              Container(
                width: 1,
                height: 28,
                margin: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md),
                color: colors.hairline,
              ),
            ],
            // Price
            if (hasPrice)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      PriceFormatter.formatString(unit.price,
                          languageCode: lang),
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: available
                            ? AppPalette.gold500
                            : colors.inkMuted,
                        letterSpacing: -0.5,
                        height: 1.0,
                      ),
                    ),
                    Text(
                      l10n.unitPrice,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: colors.inkMuted,
                      ),
                    ),
                  ],
                ),
              )
            else
              const Spacer(),
            // Status badge
            StatusBadge(
              label: unitStatusLabel(l10n, unit.status),
              tone: unitStatusTone(unit.status),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Add lead CTA card ─────────────────────────────────────────────────────────

class _AddLeadCard extends StatefulWidget {
  const _AddLeadCard(
      {required this.projectId, required this.unitId, required this.l10n});
  final String? projectId;
  final String unitId;
  final AppLocalizations l10n;

  @override
  State<_AddLeadCard> createState() => _AddLeadCardState();
}

class _AddLeadCardState extends State<_AddLeadCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => context.push('/broker/leads/new', extra: {
        if (widget.projectId != null) 'projectId': widget.projectId,
        'unitId': widget.unitId,
      }),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFAA8528), Color(0xFFC8A24B)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadii.lg),
            boxShadow: [
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.35),
                blurRadius: 16,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                      color: Colors.white.withValues(alpha: 0.25)),
                ),
                child: const Icon(Icons.person_add_alt_1_rounded,
                    color: Colors.white, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.l10n.brokerLeadNew,
                      style: const TextStyle(
                        color: _navyDeep,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'إضافة عميل محتمل لهذه الوحدة',
                      style: TextStyle(
                        color: _navyDeep.withValues(alpha: 0.55),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.add_circle_rounded,
                color: _navyDeep.withValues(alpha: 0.45),
                size: 26,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Section title ─────────────────────────────────────────────────────────────

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 4,
          height: 20,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppPalette.gold300, AppPalette.gold500],
            ),
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
                color: colors.inkStrong,
                letterSpacing: -0.2,
              ),
        ),
      ],
    );
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
        (Icons.square_foot_outlined, '${_fmtArea(unit.area)} م²',
            l10n.unitArea),
      if (unit.floor != null)
        (Icons.layers_outlined, '${unit.floor}', l10n.unitFloor),
    ];

    if (specs.isEmpty) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }

    final rows = <Widget>[];
    for (int i = 0; i < specs.length; i += 2) {
      rows.add(Row(
        children: [
          Expanded(
            child: _SpecCard(
                icon: specs[i].$1,
                value: specs[i].$2,
                label: specs[i].$3),
          ),
          if (i + 1 < specs.length) ...[
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _SpecCard(
                  icon: specs[i + 1].$1,
                  value: specs[i + 1].$2,
                  label: specs[i + 1].$3),
            ),
          ] else
            const Expanded(child: SizedBox.shrink()),
        ],
      ));
      if (i + 2 < specs.length) {
        rows.add(const SizedBox(height: AppSpacing.sm));
      }
    }

    return SliverToBoxAdapter(
        child: Column(mainAxisSize: MainAxisSize.min, children: rows));
  }
}

class _SpecCard extends StatelessWidget {
  const _SpecCard(
      {required this.icon, required this.value, required this.label});
  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(
          vertical: AppSpacing.xl, horizontal: AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border:
            Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppPalette.gold400.withValues(alpha: 0.10),
              shape: BoxShape.circle,
              border: Border.all(
                  color: AppPalette.gold400.withValues(alpha: 0.20)),
            ),
            child: Icon(icon, size: 24, color: colors.brandGold),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
              color: colors.inkStrong,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelMedium?.copyWith(
              color: colors.inkMuted,
            ),
          ),
        ],
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

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.tone});
  final String label;
  final BadgeTone tone;

  Color _bg() => switch (tone) {
        BadgeTone.success =>
          const Color(0xFF22C55E).withValues(alpha: 0.90),
        BadgeTone.warning =>
          const Color(0xFFF59E0B).withValues(alpha: 0.90),
        _ => Colors.black.withValues(alpha: 0.50),
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: _bg(),
        borderRadius: AppRadii.pillAll,
        border: Border.all(
            color: Colors.white.withValues(alpha: 0.25), width: 0.8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

// ── Circle back button ────────────────────────────────────────────────────────

class _CircleBackButton extends StatelessWidget {
  const _CircleBackButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.35),
          shape: BoxShape.circle,
          border:
              Border.all(color: Colors.white.withValues(alpha: 0.25)),
        ),
        child: const Icon(Icons.arrow_back_ios_new_rounded,
            color: Colors.white, size: 15),
      ),
    );
  }
}

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
