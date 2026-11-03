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
import '../../../../features/leads/domain/repositories/leads_repository.dart';
import '../../../installments/domain/repositories/installments_repository.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_project_detail_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid  = Color(0xFF14273F);

// ══════════════════════════════════════════════════════════════════════════════
// Screen
// ══════════════════════════════════════════════════════════════════════════════
class StaffProjectDetailScreen extends StatefulWidget {
  const StaffProjectDetailScreen({super.key, this.fallback});
  final StaffProject? fallback;

  @override
  State<StaffProjectDetailScreen> createState() =>
      _StaffProjectDetailScreenState();
}

class _StaffProjectDetailScreenState
    extends State<StaffProjectDetailScreen> {
  String? _unitStatusFilter;
  final _scroll = ScrollController();
  final _unitsSectionKey = GlobalKey();
  final _aboutKey = GlobalKey();
  final _amenitiesKey = GlobalKey();
  final _planKey = GlobalKey();
  final _paymentKey = GlobalKey();
  final _locationKey = GlobalKey();
  ProjectPlanSummary _plans = const ProjectPlanSummary();
  String? _plansFor;

  @override
  void initState() {
    super.initState();
    context.read<StaffProjectDetailCubit>().load();
  }

  // Best-effort: the page shows without them.
  Future<void> _loadPlans(String projectId) async {
    if (_plansFor == projectId) return;
    _plansFor = projectId;
    final result = await context.read<InstallmentsRepository>().projectOffers(projectId);
    if (!mounted) return;
    if (result case Ok(:final data)) setState(() => _plans = ProjectPlanSummary.fromOffers(data));
  }

  void _addInterestedClient(StaffProject p, String lang) => context.push(
        '/leads/new',
        extra: LeadInterestContext(projectId: p.id, projectName: p.name.resolve(lang)),
      );

  void _share(StaffProject p, String lang) =>
      StaffShare.project(projectId: p.id, projectName: p.name.resolve(lang), l10n: context.l10n);

  List<String> _photos(StaffProject p) {
    final seen = <String>{};
    return [if (p.coverImageUrl != null) p.coverImageUrl!, ...p.mediaUrls].where(seen.add).toList();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final l10n = context.l10n;
    final colors = context.appColors;
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: BlocBuilder<StaffProjectDetailCubit, StaffProjectDetailState>(
          builder: (context, state) {
            if (state.status == DataStatus.initial ||
                state.status == DataStatus.loading) {
              return _LoadingView(
                topInset: topInset,
                fallback: widget.fallback,
                lang: lang,
                l10n: l10n,
              );
            }

            if (state.status == DataStatus.failure) {
              return _ErrorView(
                topInset: topInset,
                fallback: widget.fallback,
                lang: lang,
                l10n: l10n,
                onRetry: () =>
                    context.read<StaffProjectDetailCubit>().load(),
              );
            }

            final detail = state.data!;
            final p = detail.project;
            final description = detail.description?.resolve(lang);
            final name = p.name.resolve(lang);
            final units = detail.units;
            final allUnits =
                context.read<StaffProjectDetailCubit>().baseUnits;

            final availableUnits =
                allUnits.where((u) => u.status == 'AVAILABLE').toList();
            final startingPrice = availableUnits.isEmpty
                ? p.startingPrice
                : availableUnits
                    .map((u) =>
                        double.tryParse(u.price ?? '') ?? double.maxFinite)
                    .reduce((a, b) => a < b ? a : b)
                    .let((v) =>
                        v == double.maxFinite ? p.startingPrice : v);
            final totalCount =
                allUnits.isEmpty ? p.totalUnitsCount : allUnits.length;
            final availCount =
                availableUnits.isEmpty && p.availableUnitsCount != null
                    ? p.availableUnitsCount
                    : availableUnits.length;

            _loadPlans(p.id);
            Widget section(String title, Widget child, Key key) => Padding(
                  key: key,
                  padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.xxl, AppSpacing.lg, 0),
                  child: _Section(title: title, child: child),
                );

            return AppDetailPage(
              onBack: () => context.pop(),
              title: name,
              subtitle: p.city,
              photos: _photos(p),
              photoPlaceholder: _NoImagePlaceholder(),
              photoBadge: StatusBadge(label: projectStatusLabel(l10n, p.status), tone: projectStatusTone(p.status)),
              bottomBar: AppDetailBottomBar(
                children: [
                  AppDetailSecondaryButton(
                    key: const Key('project-share'),
                    label: l10n.staffShareWithClient,
                    onPressed: () => _share(p, lang),
                  ),
                  AppDetailPrimaryButton(
                    key: const Key('project-add-client'),
                    label: l10n.staffAddInterestedClient,
                    onPressed: () => _addInterestedClient(p, lang),
                  ),
                ],
              ),
              slivers: [
                AppDetailPage.box(
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.md),
                    child: AppPriceCard(
                      label: startingPrice != null ? l10n.detailPricesFrom : l10n.unitPrice,
                      price: startingPrice != null
                          ? PriceFormatter.format(startingPrice, languageCode: lang)
                          : l10n.priceOnRequest,
                      caption: projectOfferLine(l10n, _plans),
                      facts: [
                        if (availCount != null)
                          AppPriceFact(
                            l10n.detailAvailableUnits,
                            totalCount != null ? '$availCount / $totalCount' : '$availCount',
                          ),
                        if (p.city?.isNotEmpty ?? false) AppPriceFact(l10n.labelCity, p.city!),
                      ],
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.md)),
                AppSectionTabsSliver(
                  tabs: [
                    if (description != null && description.isNotEmpty) AppSectionTab(l10n.detailTabOverview, _aboutKey),
                    if (p.services.isNotEmpty) AppSectionTab(l10n.detailTabAmenities, _amenitiesKey),
                    if (p.floorPlanUrls.isNotEmpty) AppSectionTab(l10n.detailTabFloorPlan, _planKey),
                    if (!_plans.isEmpty) AppSectionTab(l10n.detailTabPayment, _paymentKey),
                    if (p.hasLocation) AppSectionTab(l10n.detailTabLocation, _locationKey),
                    AppSectionTab(l10n.detailTabUnits, _unitsSectionKey),
                  ],
                ),
                SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (description != null && description.isNotEmpty)
                        section(l10n.projectAbout, _AboutBlock(text: description), _aboutKey),
                      if (p.services.isNotEmpty)
                        section(l10n.projectAmenities, _AmenitiesBlock(services: p.services), _amenitiesKey),
                      if (p.floorPlanUrls.isNotEmpty)
                        section(l10n.sectionFloorPlans, _FloorPlansGallery(urls: p.floorPlanUrls), _planKey),
                      if (!_plans.isEmpty)
                        section(l10n.detailPaymentPlans, AppPlanOfferCards(plans: _plans), _paymentKey),
                      if (p.hasLocation)
                        section(
                          l10n.projectLocation,
                          _InAppMap(lat: p.lat!, lng: p.lng!, label: p.name.resolve(lang), openLabel: l10n.openInMaps),
                          _locationKey,
                        ),

                      // Units section header
                      const SizedBox(height: AppSpacing.xxl),
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.lg),
                        child: _Section(
                          key: _unitsSectionKey,
                          title: l10n.navUnits,
                          child: const SizedBox.shrink(),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                  ),
                ),

                // ── Unit filter chips ───────────────────────────────────────
                if (allUnits.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _UnitFilterRow(
                      selected: _unitStatusFilter,
                      totalCount: allUnits.length,
                      availableCount: allUnits
                          .where((u) => u.status == 'AVAILABLE')
                          .length,
                      reservedCount: allUnits
                          .where((u) => u.status == 'RESERVED')
                          .length,
                      soldCount: allUnits
                          .where((u) => u.status == 'SOLD')
                          .length,
                      onSelected: (v) {
                        setState(() => _unitStatusFilter = v);
                        context
                            .read<StaffProjectDetailCubit>()
                            .filterByStatus(v);
                      },
                      l10n: l10n,
                    ),
                  ),

                // ── Unit cards ──────────────────────────────────────────────
                if (units.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.lg,
                          vertical: AppSpacing.lg),
                      child: Center(
                        child: Text(
                          l10n.unitsEmptyMessage,
                          style: TextStyle(
                              fontSize: 14, color: colors.inkMuted),
                        ),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.lg,
                      AppSpacing.md,
                      AppSpacing.lg,
                      bottomInset + 100,
                    ),
                    sliver: SliverList.separated(
                      itemCount: units.length,
                      itemBuilder: (_, i) =>
                          _UnitCard(unit: units[i], projectId: p.id),
                      separatorBuilder: (_, _) =>
                          const SizedBox(height: AppSpacing.sm),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Loading view
// ══════════════════════════════════════════════════════════════════════════════
class _LoadingView extends StatelessWidget {
  const _LoadingView({
    required this.topInset,
    required this.fallback,
    required this.lang,
    required this.l10n,
  });

  final double topInset;
  final StaffProject? fallback;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _FallbackHeader(
          topInset: topInset,
          title: fallback?.name.resolve(lang) ?? l10n.navProjects,
          subtitle: fallback?.city,
        ),
        const Expanded(child: StaffListSkeleton()),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Error view
// ══════════════════════════════════════════════════════════════════════════════
class _ErrorView extends StatelessWidget {
  const _ErrorView({
    required this.topInset,
    required this.fallback,
    required this.lang,
    required this.l10n,
    required this.onRetry,
  });

  final double topInset;
  final StaffProject? fallback;
  final String lang;
  final AppLocalizations l10n;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _FallbackHeader(
          topInset: topInset,
          title: fallback?.name.resolve(lang) ?? l10n.navProjects,
          subtitle: fallback?.city,
        ),
        Expanded(
          child: ErrorState(
            failure: context
                .read<StaffProjectDetailCubit>()
                .state
                .failure,
            onRetry: onRetry,
          ),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Fallback header (loading / error only)
// ══════════════════════════════════════════════════════════════════════════════
class _FallbackHeader extends StatelessWidget {
  const _FallbackHeader({
    required this.topInset,
    required this.title,
    this.subtitle,
  });

  final double topInset;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          AppSpacing.md,
          topInset + AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.md),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [_navyMid, _navyDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Row(
        children: [
          _FallbackBackButton(),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700)),
                if (subtitle != null)
                  Text(subtitle!,
                      style: const TextStyle(
                          color: Colors.white60,
                          fontSize: 13,
                          fontWeight: FontWeight.w400)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FallbackBackButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return NavHeaderBack();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Glass circle back button (used in hero AppBar)
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// Hero background (used inside FlexibleSpaceBar)
// ══════════════════════════════════════════════════════════════════════════════
class _NoImagePlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: _navyDeep,
      child: Center(
        child: Icon(
          Icons.apartment_outlined,
          size: 64,
          color: Color(0x40FFFFFF),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Staff actions — primary row + secondary row
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// Stats bar — unified horizontal card with gold shimmer top bar
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// Section wrapper — gold-bar label + content
// ══════════════════════════════════════════════════════════════════════════════
class _Section extends StatelessWidget {
  const _Section({
    super.key,
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppDetailSectionTitle(title),
        if (child is! SizedBox) ...[
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// About block — surfaceSoft container with gold left bar + expand/collapse
// ══════════════════════════════════════════════════════════════════════════════
class _AboutBlock extends StatefulWidget {
  const _AboutBlock({required this.text});
  final String text;

  @override
  State<_AboutBlock> createState() => _AboutBlockState();
}

class _AboutBlockState extends State<_AboutBlock> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;
    final textStyle = theme.textTheme.bodyMedium?.copyWith(
      color: colors.inkStrong.withValues(alpha: 0.85),
      height: 1.75,
    );

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Subtract gold bar (3px) + gap (AppSpacing.md) from text width
          final tp = TextPainter(
            text: TextSpan(text: widget.text, style: textStyle),
            maxLines: 3,
            textDirection: Directionality.of(context),
          )..layout(maxWidth: constraints.maxWidth - 3 - AppSpacing.md);
          final overflows = tp.didExceedMaxLines;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      width: 3,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [AppPalette.gold300, AppPalette.gold500],
                        ),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Flexible(
                      child: Text(
                        widget.text,
                        maxLines: _expanded ? null : 3,
                        overflow: _expanded
                            ? TextOverflow.visible
                            : TextOverflow.ellipsis,
                        style: textStyle,
                      ),
                    ),
                  ],
                ),
              ),
              if (overflows) ...[
                const SizedBox(height: AppSpacing.sm),
                GestureDetector(
                  onTap: () => setState(() => _expanded = !_expanded),
                  child: Text(
                    _expanded ? l10n.showLess : l10n.showMore,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: colors.brandGold,
                    ),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Unit status filter row — matches projects/leads chip pattern
// ══════════════════════════════════════════════════════════════════════════════
class _UnitFilterRow extends StatelessWidget {
  const _UnitFilterRow({
    required this.selected,
    required this.totalCount,
    required this.availableCount,
    required this.reservedCount,
    required this.soldCount,
    required this.onSelected,
    required this.l10n,
  });

  final String? selected;
  final int totalCount;
  final int availableCount;
  final int reservedCount;
  final int soldCount;
  final ValueChanged<String?> onSelected;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    final chips = [
      (null, l10n.leadsFilterAll, totalCount, colors.brandGold),
      ('AVAILABLE', l10n.unitStatusAvailable, availableCount, colors.success),
      ('RESERVED', l10n.unitStatusReserved, reservedCount, colors.warning),
      ('SOLD', l10n.unitStatusSold, soldCount, const Color(0xFFEF4444)),
    ];

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
          vertical: 6,
        ),
        child: Row(
          children: [
            for (int i = 0; i < chips.length; i++) ...[
              if (i > 0) const SizedBox(width: AppSpacing.xs),
              _UnitStatusChip(
                label: chips[i].$2,
                count: chips[i].$3,
                dotColor: chips[i].$4,
                isSelected: selected == chips[i].$1,
                onTap: () => onSelected(chips[i].$1),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _UnitStatusChip extends StatelessWidget {
  const _UnitStatusChip({
    required this.label,
    required this.count,
    required this.dotColor,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final int count;
  final Color dotColor;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppFilterChip(label: label, count: count, selected: isSelected, onTap: onTap, dotColor: dotColor);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Unit card — status accent bar + price hero + gradient send button
// ══════════════════════════════════════════════════════════════════════════════
class _UnitCard extends StatelessWidget {
  const _UnitCard({required this.unit, required this.projectId});
  final StaffUnit unit;
  final String projectId;

  static String _formatArea(String? raw) {
    final n = num.tryParse(raw ?? '');
    if (n == null) return raw ?? '';
    return n == n.truncateToDouble()
        ? n.toInt().toString()
        : n.toStringAsFixed(1);
  }

  Color _accentColor(AppColorsExt colors) => switch (unit.status) {
        'AVAILABLE' => colors.success,
        'RESERVED' => colors.warning,
        'SOLD' => const Color(0xFFEF4444),
        _ => colors.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final hasPrice = unit.price != null && unit.price!.isNotEmpty;
    final available = unit.status == 'AVAILABLE';
    final accent = _accentColor(colors);

    return GestureDetector(
      onTap: () =>
          context.push('/units/${unit.id}', extra: {'projectId': projectId}),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(
              color: colors.hairline.withValues(alpha: 0.6)),
          boxShadow: [
            BoxShadow(
              color: accent.withValues(alpha: 0.10),
              blurRadius: 18,
              offset: const Offset(0, 5),
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Status accent bar at start (right in RTL)
              Container(
                width: 4,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      accent.withValues(alpha: 0.65),
                      accent,
                    ],
                  ),
                ),
              ),
              // Card content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header: code + type + badge
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                          AppSpacing.md, AppSpacing.md,
                          AppSpacing.md, 0),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                Text(
                                  unit.code,
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w900,
                                    color: colors.inkStrong,
                                    letterSpacing: 0.2,
                                  ),
                                ),
                                if (unit.type != null) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    unit.typeLabel(Localizations.localeOf(context).languageCode),
                                    style: TextStyle(
                                        fontSize: 13,
                                        color: colors.inkMuted),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          StatusBadge(
                            label: unitStatusLabel(l10n, unit.status),
                            tone: unitStatusTone(unit.status),
                          ),
                        ],
                      ),
                    ),

                    // Price + specs
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                          AppSpacing.md, AppSpacing.sm,
                          AppSpacing.md, AppSpacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (hasPrice) ...[
                            Text(
                              PriceFormatter.formatString(unit.price,
                                  languageCode: lang),
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                color: available
                                    ? colors.brandGold
                                    : colors.inkMuted,
                                height: 1.2,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                          ],
                          Wrap(
                            spacing: AppSpacing.xs,
                            runSpacing: AppSpacing.xs,
                            children: [
                              if (unit.area != null)
                                _SpecPill(
                                  icon: Icons.square_foot_rounded,
                                  label: context.l10n.unitAreaValue(_formatArea(unit.area)),
                                ),
                              if (unit.bedrooms != null &&
                                  unit.bedrooms! > 0)
                                _SpecPill(
                                  icon: Icons.bed_outlined,
                                  label: '${unit.bedrooms} ${l10n.unitBedrooms}',
                                ),
                              if (unit.floor != null)
                                _SpecPill(
                                  icon: Icons.layers_outlined,
                                  label: '${l10n.unitFloor} ${unit.floor}',
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Footer
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md, vertical: 12),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.07),
                        border: Border(
                          top: BorderSide(
                              color: accent.withValues(alpha: 0.15),
                              width: 0.5),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment:
                            MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                l10n.viewUnit,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: colors.brandGold,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Icon(
                                Icons.arrow_back_ios_new_rounded,
                                size: 12,
                                color: colors.brandGold,
                              ),
                            ],
                          ),
                          if (available)
                            _SendChip(unit: unit, l10n: l10n),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SendChip extends StatelessWidget {
  const _SendChip({required this.unit, required this.l10n});
  final StaffUnit unit;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        final state = context.read<StaffProjectDetailCubit>().state;
        final lang  = Localizations.localeOf(context).languageCode;
        StaffShare.unit(
          unitId:      unit.id,
          unitCode:    unit.code,
          projectName: state.data?.project.name.resolve(lang) ?? '',
          l10n: context.l10n,
        );
      },
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppPalette.gold300, AppPalette.gold500],
          ),
          borderRadius: AppRadii.pillAll,
          boxShadow: [
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.35),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.send_rounded,
                size: 12, color: Colors.white),
            const SizedBox(width: 5),
            Text(
              l10n.staffSendToClient,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Spec pill
// ══════════════════════════════════════════════════════════════════════════════
class _SpecPill extends StatelessWidget {
  const _SpecPill({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: colors.hairline),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.inkMuted),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: colors.inkStrong,
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Amenities block — wrapped chip grid
// ══════════════════════════════════════════════════════════════════════════════
class _AmenitiesBlock extends StatelessWidget {
  const _AmenitiesBlock({required this.services});
  final List<String> services;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        for (final s in services)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppPalette.gold400.withValues(alpha: 0.08),
              borderRadius: AppRadii.pillAll,
              border: Border.all(
                color: AppPalette.gold400.withValues(alpha: 0.22),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.check_circle_rounded,
                  size: 13,
                  color: AppPalette.gold500,
                ),
                const SizedBox(width: 5),
                Text(
                  s,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: colors.inkStrong,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// In-app map — embedded OpenStreetMap tile view with a gold pin and an
// "Open in Maps" overlay button (bottom-right)
// ══════════════════════════════════════════════════════════════════════════════
class _InAppMap extends StatelessWidget {
  const _InAppMap({
    required this.lat,
    required this.lng,
    required this.label,
    required this.openLabel,
  });
  final double lat;
  final double lng;
  final String label;
  final String openLabel;

  @override
  Widget build(BuildContext context) {
    final point = LatLng(lat, lng);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      child: SizedBox(
        height: 220,
        child: Stack(
          children: [
            FlutterMap(
              options: MapOptions(
                initialCenter: point,
                initialZoom: 15,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.pinchZoom | InteractiveFlag.doubleTapZoom,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.devora.staff',
                  maxZoom: 19,
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: point,
                      width: 48,
                      height: 48,
                      child: const _MapPin(),
                    ),
                  ],
                ),
              ],
            ),
            // Open in Maps overlay button
            PositionedDirectional(
              bottom: AppSpacing.sm,
              end: AppSpacing.sm,
              child: GestureDetector(
                onTap: () => ContactActions.openMap(
                  lat: lat,
                  lng: lng,
                  label: label,
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
                        openLabel,
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
    );
  }
}

class _MapPin extends StatelessWidget {
  const _MapPin();

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
            Icons.apartment_rounded,
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
// Floor plans gallery — horizontally swipeable full-width image viewer
// ══════════════════════════════════════════════════════════════════════════════
class _FloorPlansGallery extends StatefulWidget {
  const _FloorPlansGallery({required this.urls});
  final List<String> urls;

  @override
  State<_FloorPlansGallery> createState() => _FloorPlansGalleryState();
}

class _FloorPlansGalleryState extends State<_FloorPlansGallery> {
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
            // Page counter pill — top end
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
            // Prev / next arrows
            if (multi) ...[
              Positioned(
                left: 6,
                top: 0,
                bottom: 0,
                child: Center(
                  child: _ArrowBtn(
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
                  child: _ArrowBtn(
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

class _ArrowBtn extends StatelessWidget {
  const _ArrowBtn({required this.icon, required this.onTap});
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
        child: Icon(icon,
            size: 20,
            color: Colors.white.withValues(alpha: enabled ? 1.0 : 0.35)),
      ),
    );
  }
}

extension _DoubleX on double {
  T let<T>(T Function(double) fn) => fn(this);
}
