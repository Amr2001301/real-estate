import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../../../common/catalog_status_label.dart';
import '../../domain/entities/broker_project.dart';
import '../cubit/broker_units_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);
const _navyLight = Color(0xFF243F62);

class BrokerProjectDetailScreen extends StatefulWidget {
  const BrokerProjectDetailScreen({super.key, required this.project});
  final BrokerProject project;

  @override
  State<BrokerProjectDetailScreen> createState() =>
      _BrokerProjectDetailScreenState();
}

class _BrokerProjectDetailScreenState
    extends State<BrokerProjectDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerUnitsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final p = widget.project;
    final name = p.name.resolve(lang);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light
          .copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: CustomScrollView(
          slivers: [
            // ── Collapsing hero ─────────────────────────────────────────────
            SliverAppBar(
              expandedHeight: 300,
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
                    AppSpacing.xl, 0, AppSpacing.lg, AppSpacing.lg),
                title: Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.3,
                    shadows: [
                      Shadow(color: Colors.black54, blurRadius: 10),
                    ],
                  ),
                ),
                background:
                    _HeroBackground(project: p, l10n: l10n, lang: lang),
              ),
            ),

            // ── Body ────────────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _MetaStrip(project: p, l10n: l10n),

                  // Add lead CTA
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                        AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
                    child: _AddLeadCard(projectId: p.id, l10n: l10n),
                  ),

                  // About
                  if (p.description != null) ...[
                    const SizedBox(height: AppSpacing.lg),
                    _AboutSection(project: p, lang: lang, l10n: l10n),
                  ],

                  // Services / advantages
                  if (p.services != null && p.services!.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.lg),
                    _ServicesSection(project: p, lang: lang, l10n: l10n),
                  ],

                  // Map
                  if (p.lat != null && p.lng != null) ...[
                    const SizedBox(height: AppSpacing.lg),
                    _MapSection(project: p, lang: lang),
                  ],

                  // Units
                  const SizedBox(height: AppSpacing.lg),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md),
                    child: AppSectionHeader(title: l10n.navUnits),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _Units(projectId: p.id),
                  const SizedBox(height: 48),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Hero background ───────────────────────────────────────────────────────────

class _HeroBackground extends StatelessWidget {
  const _HeroBackground({
    required this.project,
    required this.l10n,
    required this.lang,
  });
  final BrokerProject project;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.paddingOf(context).top;
    return Stack(
      fit: StackFit.expand,
      children: [
        AppNetworkImage(url: project.coverImageUrl),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0x88000000),
                Color(0x22000000),
                Color(0xCC000000),
                Color(0xF2050E18),
              ],
              stops: [0.0, 0.30, 0.70, 1.0],
            ),
          ),
        ),
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
        PositionedDirectional(
          top: topPad + 10,
          end: AppSpacing.md,
          child: StatusBadge(
            label: projectStatusLabel(l10n, project.status),
            tone: projectStatusTone(project.status),
            variant: BadgeVariant.solid,
          ),
        ),
        if (project.commissionPct != null)
          PositionedDirectional(
            top: topPad + 10,
            start: 56,
            child: _CommissionPill(pct: project.commissionPct!, lang: lang),
          ),
        if (project.city != null)
          PositionedDirectional(
            bottom: AppSpacing.xl + 36,
            start: AppSpacing.lg,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: AppPalette.gold400,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppPalette.gold400.withValues(alpha: 0.6),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  project.city!.toUpperCase(),
                  style: const TextStyle(
                    color: AppPalette.gold300,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.6,
                    shadows: [
                      Shadow(color: Color(0x88000000), blurRadius: 6),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _CommissionPill extends StatelessWidget {
  const _CommissionPill({required this.pct, required this.lang});
  final String pct;
  final String lang;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFAA8528), Color(0xFFC8A24B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.40),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        lang == 'ar' ? 'عمولة $pct%' : '$pct% comm.',
        style: const TextStyle(
          color: Color(0xFF0B1726),
          fontSize: 11,
          fontWeight: FontWeight.w800,
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
          border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
        ),
        child: const Icon(Icons.arrow_back_ios_new_rounded,
            color: Colors.white, size: 15),
      ),
    );
  }
}

// ── Meta strip ────────────────────────────────────────────────────────────────

class _MetaStrip extends StatelessWidget {
  const _MetaStrip({required this.project, required this.l10n});
  final BrokerProject project;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
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
            if (project.commissionPct != null) ...[
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${project.commissionPct}%',
                    style: const TextStyle(
                      color: AppPalette.gold500,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      height: 1.0,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    l10n.brokerCommissionPct,
                    style: TextStyle(
                        color: colors.inkMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.w500),
                  ),
                ],
              ),
              Container(
                width: 1,
                height: 32,
                margin:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                color: colors.hairline,
              ),
            ],
            if (project.city != null) ...[
              Icon(Icons.location_on_rounded,
                  size: 14, color: colors.inkMuted),
              const SizedBox(width: 4),
              Text(
                project.city!,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: colors.inkStrong,
                ),
              ),
            ],
            const Spacer(),
            StatusBadge(
              label: projectStatusLabel(l10n, project.status),
              tone: projectStatusTone(project.status),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Add lead CTA ──────────────────────────────────────────────────────────────

class _AddLeadCard extends StatefulWidget {
  const _AddLeadCard({required this.projectId, required this.l10n});
  final String projectId;
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
      onTap: () => context.push('/broker/leads/new',
          extra: {'projectId': widget.projectId}),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFAA8528), Color(0xFFC8A24B)],
              begin: Alignment.topRight,
              end: Alignment.bottomLeft,
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
                        color: Color(0xFF0B1726),
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'إضافة عميل محتمل لهذا المشروع',
                      style: TextStyle(
                        color: const Color(0xFF0B1726)
                            .withValues(alpha: 0.55),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.add_circle_rounded,
                color: const Color(0xFF0B1726).withValues(alpha: 0.45),
                size: 26,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── About section ─────────────────────────────────────────────────────────────

class _AboutSection extends StatefulWidget {
  const _AboutSection(
      {required this.project, required this.lang, required this.l10n});
  final BrokerProject project;
  final String lang;
  final AppLocalizations l10n;

  @override
  State<_AboutSection> createState() => _AboutSectionState();
}

class _AboutSectionState extends State<_AboutSection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final text =
        widget.project.description!.resolve(widget.lang).trim();
    if (text.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSectionHeader(title: 'عن المشروع'),
          const SizedBox(height: AppSpacing.sm),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: AppRadii.card,
              border: Border.all(
                  color: colors.hairline.withValues(alpha: 0.5)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Gold accent dot + "عن المشروع" label
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: AppPalette.gold400,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color:
                                AppPalette.gold400.withValues(alpha: 0.5),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'التفاصيل',
                      style: TextStyle(
                        color: AppPalette.gold500,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                AnimatedCrossFade(
                  firstChild: Text(
                    text,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colors.ink,
                      height: 1.7,
                    ),
                  ),
                  secondChild: Text(
                    text,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colors.ink,
                      height: 1.7,
                    ),
                  ),
                  crossFadeState: _expanded
                      ? CrossFadeState.showSecond
                      : CrossFadeState.showFirst,
                  duration: const Duration(milliseconds: 250),
                ),
                if (text.length > 120) ...[
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () =>
                        setState(() => _expanded = !_expanded),
                    child: Text(
                      _expanded ? 'عرض أقل' : 'عرض المزيد',
                      style: const TextStyle(
                        color: AppPalette.gold500,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Services / advantages ─────────────────────────────────────────────────────

class _ServicesSection extends StatelessWidget {
  const _ServicesSection(
      {required this.project, required this.lang, required this.l10n});
  final BrokerProject project;
  final String lang;
  final AppLocalizations l10n;

  static const _icons = [
    Icons.pool_rounded,
    Icons.fitness_center_rounded,
    Icons.security_rounded,
    Icons.local_parking_rounded,
    Icons.park_rounded,
    Icons.mosque_rounded,
    Icons.school_rounded,
    Icons.shopping_cart_rounded,
    Icons.restaurant_rounded,
    Icons.elevator_rounded,
    Icons.camera_indoor_rounded,
    Icons.wb_sunny_rounded,
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final services = project.services!;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSectionHeader(title: 'مميزات المشروع'),
          const SizedBox(height: AppSpacing.sm),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: AppRadii.card,
              border: Border.all(
                  color: colors.hairline.withValues(alpha: 0.5)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (int i = 0; i < services.length; i++)
                  _ServiceChip(
                    label: services[i].resolve(lang),
                    icon: _icons[i % _icons.length],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ServiceChip extends StatelessWidget {
  const _ServiceChip({required this.label, required this.icon});
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: _navyLight.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(
            color: AppPalette.gold400.withValues(alpha: 0.20)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppPalette.gold500),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: colors.inkStrong,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Map section ───────────────────────────────────────────────────────────────

class _MapSection extends StatelessWidget {
  const _MapSection({required this.project, required this.lang});
  final BrokerProject project;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final lat = project.lat!;
    final lng = project.lng!;
    final center = LatLng(lat, lng);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSectionHeader(title: 'موقع المشروع'),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: AppRadii.card,
            child: Container(
              height: 220,
              decoration: BoxDecoration(
                borderRadius: AppRadii.card,
                border: Border.all(
                    color: colors.hairline.withValues(alpha: 0.4)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Stack(
                children: [
                  FlutterMap(
                    options: MapOptions(
                      initialCenter: center,
                      initialZoom: 14,
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
                            point: center,
                            width: 52,
                            height: 52,
                            child: const _ProjectMapPin(),
                          ),
                        ],
                      ),
                    ],
                  ),
                  // Open in maps button
                  PositionedDirectional(
                    bottom: AppSpacing.sm,
                    end: AppSpacing.sm,
                    child: GestureDetector(
                      onTap: () => ContactActions.openMap(
                        lat: lat,
                        lng: lng,
                        label: project.name.resolve(lang),
                      ),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: _navyDeep.withValues(alpha: 0.88),
                          borderRadius:
                              BorderRadius.circular(AppRadii.md),
                          border: Border.all(
                              color: AppPalette.gold400
                                  .withValues(alpha: 0.35)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.open_in_new_rounded,
                                color: AppPalette.gold300, size: 13),
                            const SizedBox(width: 6),
                            Text(
                              lang == 'ar'
                                  ? 'فتح في الخرائط'
                                  : 'Open in Maps',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
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
      ),
    );
  }
}

class _ProjectMapPin extends StatelessWidget {
  const _ProjectMapPin();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFAA8528), Color(0xFFC8A24B)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.5),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
            ],
            border: Border.all(color: Colors.white, width: 2.5),
          ),
          child: const Icon(Icons.apartment_rounded,
              color: Color(0xFF0B1726), size: 16),
        ),
        Container(
          width: 2,
          height: 10,
          color: AppPalette.gold400,
        ),
      ],
    );
  }
}

// ── Units ─────────────────────────────────────────────────────────────────────

class _Units extends StatelessWidget {
  const _Units({required this.projectId});
  final String projectId;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BlocBuilder<BrokerUnitsCubit, BrokerUnitsState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return _UnitsSkeleton();
          case DataStatus.failure:
            return Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: ErrorState(
                failure: state.failure,
                onRetry: () => context.read<BrokerUnitsCubit>().load(),
              ),
            );
          case DataStatus.empty:
            return Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: EmptyState(
                icon: Icons.door_front_door_outlined,
                title: l10n.unitsEmptyMessage,
              ),
            );
          case DataStatus.success:
            final units = state.data!;
            final available =
                units.where((u) => u.status.toUpperCase() == 'AVAILABLE').length;
            return Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Summary chips
                  Row(
                    children: [
                      _UnitCountChip(
                        count: units.length,
                        label: 'إجمالي',
                        color: const Color(0xFF6B7280),
                      ),
                      const SizedBox(width: 8),
                      _UnitCountChip(
                        count: available,
                        label: 'متاح',
                        color: const Color(0xFF22C55E),
                      ),
                      const SizedBox(width: 8),
                      _UnitCountChip(
                        count: units.length - available,
                        label: 'غير متاح',
                        color: const Color(0xFFF59E0B),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  for (int i = 0; i < units.length; i++) ...[
                    _UnitCard(
                        unit: units[i], projectId: projectId),
                    if (i < units.length - 1)
                      const SizedBox(height: AppSpacing.sm),
                  ],
                ],
              ),
            );
        }
      },
    );
  }
}

class _UnitCountChip extends StatelessWidget {
  const _UnitCountChip(
      {required this.count,
      required this.label,
      required this.color});
  final int count;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration:
                BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            '$count $label',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _UnitCard extends StatefulWidget {
  const _UnitCard({required this.unit, required this.projectId});
  final BrokerUnit unit;
  final String projectId;

  @override
  State<_UnitCard> createState() => _UnitCardState();
}

class _UnitCardState extends State<_UnitCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final unit = widget.unit;
    final statusColor = _statusColor(unit.status);

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => context.push('/broker/units/${unit.id}',
          extra: {'unit': unit, 'projectId': widget.projectId}),
      child: AnimatedScale(
        scale: _pressed ? 0.98 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: statusColor.withValues(alpha: 0.18),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              // Status color rail
              Container(
                width: 4,
                height: 72,
                decoration: BoxDecoration(
                  color: statusColor,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    bottomLeft: Radius.circular(16),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              // Icon
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: statusColor.withValues(alpha: 0.25)),
                ),
                child: Icon(_statusIcon(unit.status),
                    color: statusColor, size: 20),
              ),
              const SizedBox(width: 12),
              // Code + meta
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      unit.code,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        if (unit.type != null) ...[
                          _TypeChip(type: unit.type!),
                          const SizedBox(width: 6),
                        ],
                        if (unit.price != null)
                          Flexible(
                            child: Text(
                              PriceFormatter.formatString(unit.price,
                                  languageCode: lang),
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppPalette.gold500,
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
              const SizedBox(width: 8),
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  StatusBadge(
                    label: unitStatusLabel(l10n, unit.status),
                    tone: unitStatusTone(unit.status),
                  ),
                  if (unit.area != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${unit.area} م²',
                      style: TextStyle(
                        fontSize: 10,
                        color: colors.inkMuted,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(width: 14),
            ],
          ),
        ),
      ),
    );
  }

  static Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'AVAILABLE':
        return const Color(0xFF22C55E);
      case 'RESERVED':
        return const Color(0xFFF59E0B);
      case 'SOLD':
        return const Color(0xFFEF4444);
      default:
        return const Color(0xFF6B7280);
    }
  }

  static IconData _statusIcon(String status) {
    switch (status.toUpperCase()) {
      case 'AVAILABLE':
        return Icons.door_front_door_rounded;
      case 'RESERVED':
        return Icons.bookmark_rounded;
      case 'SOLD':
        return Icons.check_circle_rounded;
      default:
        return Icons.door_front_door_outlined;
    }
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({required this.type});
  final String type;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: _navyLight.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        type,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: _navyMid,
        ),
      ),
    );
  }
}

class _UnitsSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AppSkeletonizer(
      enabled: true,
      child: Padding(
        padding:
            const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        child: Column(
          children: [
            for (int i = 0; i < 4; i++) ...[
              if (i > 0) const SizedBox(height: AppSpacing.sm),
              Container(
                height: 72,
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
