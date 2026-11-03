import 'package:core/core.dart';
import 'package:flutter/material.dart';
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
  final _aboutKey = GlobalKey();
  final _servicesKey = GlobalKey();
  final _mapKey = GlobalKey();
  final _unitsKey = GlobalKey();

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
    final hasServices = p.services != null && p.services!.isNotEmpty;
    final hasMap = p.lat != null && p.lng != null;
    Widget anchored(Key key, Widget child) => Padding(
          key: key,
          padding: const EdgeInsets.only(top: AppSpacing.lg),
          child: child,
        );

    return AppDetailPage(
      onBack: () => context.pop(),
      title: name,
      subtitle: p.city,
      photos: [if (p.coverImageUrl != null) p.coverImageUrl!],
      photoBadge: StatusBadge(label: projectStatusLabel(l10n, p.status), tone: projectStatusTone(p.status)),
      bottomBar: AppDetailBottomBar(
        children: [
          AppDetailPrimaryButton(
            key: const Key('broker-project-add-lead'),
            label: l10n.brokerLeadNew,
            icon: Icons.person_add_alt_1_rounded,
            onPressed: () => context.push('/broker/leads/new', extra: {'projectId': p.id}),
          ),
        ],
      ),
      slivers: [
        if (p.commissionPct != null)
          AppDetailPage.box(
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.md),
              child: AppPriceCard(
                label: l10n.brokerCommissionPct,
                price: '${p.commissionPct}%',
                facts: [if (p.city != null) AppPriceFact(l10n.labelCity, p.city!)],
              ),
            ),
          ),
        const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.md)),
        AppSectionTabsSliver(
          tabs: [
            if (p.description != null) AppSectionTab(l10n.detailTabOverview, _aboutKey),
            if (hasServices) AppSectionTab(l10n.detailTabAmenities, _servicesKey),
            if (hasMap) AppSectionTab(l10n.detailTabLocation, _mapKey),
            AppSectionTab(l10n.detailTabUnits, _unitsKey),
          ],
        ),
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (p.description != null) anchored(_aboutKey, _AboutSection(project: p, lang: lang, l10n: l10n)),
              if (hasServices) anchored(_servicesKey, _ServicesSection(project: p, lang: lang, l10n: l10n)),
              if (hasMap) anchored(_mapKey, _MapSection(project: p, lang: lang)),
              Padding(
                key: _unitsKey,
                padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.lg, AppSpacing.md, 0),
                child: AppDetailSectionTitle(l10n.navUnits),
              ),
              const SizedBox(height: AppSpacing.sm),
              _Units(projectId: p.id),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Hero background ───────────────────────────────────────────────────────────

// ── Circle back button ────────────────────────────────────────────────────────

// ── Meta strip ────────────────────────────────────────────────────────────────

// ── Add lead CTA ──────────────────────────────────────────────────────────────

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
          AppDetailSectionTitle(context.l10n.aboutTheProject),
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
                      context.l10n.detailsLabel,
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
                      _expanded ? context.l10n.showLess : context.l10n.showMore,
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
          AppDetailSectionTitle(context.l10n.projectFeatures),
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
          AppDetailSectionTitle(context.l10n.projectLocationTitle),
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
                        label: context.l10n.totalLabel,
                        color: const Color(0xFF6B7280),
                      ),
                      const SizedBox(width: 8),
                      _UnitCountChip(
                        count: available,
                        label: context.l10n.availableLabel,
                        color: const Color(0xFF22C55E),
                      ),
                      const SizedBox(width: 8),
                      _UnitCountChip(
                        count: units.length - available,
                        label: context.l10n.unavailableLabel,
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
                          _TypeChip(type: unitTypeLabel(unit.type, languageCode: Localizations.localeOf(context).languageCode)),
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
                      context.l10n.unitAreaValue('${unit.area}'),
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
