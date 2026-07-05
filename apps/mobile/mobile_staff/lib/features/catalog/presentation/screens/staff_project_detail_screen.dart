import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/catalog_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_project_detail_cubit.dart';

class StaffProjectDetailScreen extends StatefulWidget {
  const StaffProjectDetailScreen({super.key, this.fallback});
  final StaffProject? fallback;

  @override
  State<StaffProjectDetailScreen> createState() =>
      _StaffProjectDetailScreenState();
}

class _StaffProjectDetailScreenState extends State<StaffProjectDetailScreen> {
  String? _unitStatusFilter; // null = all

  @override
  void initState() {
    super.initState();
    context.read<StaffProjectDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final l10n = context.l10n;
    final colors = context.appColors;
    final topPad = MediaQuery.of(context).padding.top;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      body: BlocBuilder<StaffProjectDetailCubit, StaffProjectDetailState>(
        builder: (context, state) {
          // ── Loading ──────────────────────────────────────────────────────────
          if (state.status == DataStatus.initial ||
              state.status == DataStatus.loading) {
            return Column(
              children: [
                _FallbackHeader(
                  topPad: topPad,
                  title: widget.fallback?.name.resolve(lang) ?? l10n.navProjects,
                  subtitle: widget.fallback?.city,
                ),
                const Expanded(child: StaffListSkeleton()),
              ],
            );
          }

          // ── Error ────────────────────────────────────────────────────────────
          if (state.status == DataStatus.failure) {
            return Column(
              children: [
                _FallbackHeader(
                  topPad: topPad,
                  title: widget.fallback?.name.resolve(lang) ?? l10n.navProjects,
                  subtitle: widget.fallback?.city,
                ),
                Expanded(
                  child: ErrorState(
                    failure: state.failure,
                    onRetry: () =>
                        context.read<StaffProjectDetailCubit>().load(),
                  ),
                ),
              ],
            );
          }

          // ── Success ──────────────────────────────────────────────────────────
          final detail = state.data!;
          final p = detail.project;
          final description = detail.description?.resolve(lang);
          final name = p.name.resolve(lang);
          final allUnits = detail.units;

          // Client-side filter (no cubit change)
          final units = _unitStatusFilter == null
              ? allUnits
              : allUnits
                  .where((u) => u.status == _unitStatusFilter)
                  .toList();

          // Compute unit aggregates from the loaded units list
          final availableUnits =
              allUnits.where((u) => u.status == 'AVAILABLE').toList();
          final soldCount =
              allUnits.where((u) => u.status == 'SOLD').length;
          final startingPrice = availableUnits.isEmpty
              ? p.startingPrice // fall back to list-endpoint value
              : availableUnits
                  .map((u) =>
                      double.tryParse(u.price ?? '') ?? double.maxFinite)
                  .reduce((a, b) => a < b ? a : b)
                  .let((v) => v == double.maxFinite ? p.startingPrice : v);
          final totalCount = allUnits.isEmpty
              ? p.totalUnitsCount
              : allUnits.length;
          final availCount = availableUnits.isEmpty && p.availableUnitsCount != null
              ? p.availableUnitsCount
              : availableUnits.length;

          return CustomScrollView(
            slivers: [
              // ── Hero sliver app bar ──────────────────────────────────────────
              SliverAppBar(
                expandedHeight: 260,
                pinned: true,
                backgroundColor: colors.brandNavy,
                surfaceTintColor: Colors.transparent,
                foregroundColor: Colors.white,
                leading: _BackButton(topPad: topPad),
                title: Text(
                  name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                flexibleSpace: FlexibleSpaceBar(
                  collapseMode: CollapseMode.pin,
                  background: _HeroImage(
                    mediaUrls: p.mediaUrls,
                    coverImageUrl: p.coverImageUrl,
                    status: p.status,
                    statusLabel: projectStatusLabel(l10n, p.status),
                    statusTone: projectStatusTone(p.status),
                    name: name,
                    city: p.city,
                    topPad: topPad,
                  ),
                ),
              ),
              // ── Body ─────────────────────────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.md,
                    0,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Metrics strip
                      if (availCount != null ||
                          totalCount != null ||
                          startingPrice != null)
                        _MetricsStrip(
                          available: availCount,
                          total: totalCount,
                          startingPrice: startingPrice,
                          sold: soldCount > 0 ? soldCount : null,
                          lang: lang,
                        ),
                      // Description
                      if (description != null && description.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.lg),
                        _DescriptionSection(
                          title: l10n.projectAbout,
                          text: description,
                        ),
                      ],
                      // Units section header + filter
                      const SizedBox(height: AppSpacing.lg),
                      _SectionTitle(title: l10n.navUnits),
                      const SizedBox(height: AppSpacing.sm),
                      if (allUnits.isNotEmpty) ...[
                        AppFilterPills<String?>(
                          allLabel: l10n.leadsFilterAll,
                          selected: _unitStatusFilter,
                          onSelected: (v) =>
                              setState(() => _unitStatusFilter = v),
                          options: const [
                            FilterPillOption(
                                value: 'AVAILABLE', label: 'متاحة'),
                            FilterPillOption(
                                value: 'RESERVED', label: 'محجوزة'),
                            FilterPillOption(value: 'SOLD', label: 'مباعة'),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                      ],
                    ],
                  ),
                ),
              ),
              // ── Units list ────────────────────────────────────────────────────
              if (units.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md, vertical: AppSpacing.lg),
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
                    AppSpacing.md,
                    0,
                    AppSpacing.md,
                    bottomPad + 32,
                  ),
                  sliver: SliverList.separated(
                    itemCount: units.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: AppSpacing.sm),
                    itemBuilder: (context, i) => _UnitCard(
                      unit: units[i],
                      projectId: p.id,
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Hero image
// ══════════════════════════════════════════════════════════════════════════════
class _HeroImage extends StatelessWidget {
  const _HeroImage({
    required this.mediaUrls,
    required this.coverImageUrl,
    required this.status,
    required this.statusLabel,
    required this.statusTone,
    required this.name,
    required this.city,
    required this.topPad,
  });

  final List<String> mediaUrls;
  final String? coverImageUrl;
  final String status;
  final String statusLabel;
  final BadgeTone statusTone;
  final String name;
  final String? city;
  final double topPad;

  String? get _heroUrl => coverImageUrl ?? (mediaUrls.isNotEmpty ? mediaUrls.first : null);

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final heroUrl = _heroUrl;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Image or placeholder
        if (heroUrl != null)
          AppNetworkImage(url: heroUrl)
        else
          _NoImagePlaceholder(),

        // Bottom-to-top gradient — lets title legibly overlay image
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                colors.brandNavy.withValues(alpha: 0.55),
                Colors.black.withValues(alpha: 0.70),
              ],
            ),
          ),
        ),

        // Status badge — top trailing corner
        PositionedDirectional(
          top: topPad + 56,
          end: AppSpacing.md,
          child: StatusBadge(
            label: statusLabel,
            tone: statusTone,
            variant: BadgeVariant.solid,
          ),
        ),

        // Name + city at bottom
        PositionedDirectional(
          start: AppSpacing.md,
          end: AppSpacing.md,
          bottom: AppSpacing.lg,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                name,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  height: 1.2,
                  shadows: [Shadow(blurRadius: 6, color: Colors.black54)],
                ),
              ),
              if (city != null) ...[
                const SizedBox(height: 3),
                Row(
                  children: [
                    const Icon(Icons.location_on_rounded,
                        size: 14, color: Colors.white70),
                    const SizedBox(width: 3),
                    Text(
                      city!,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Colors.white70,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
              // Image count pill
              if (mediaUrls.length > 1) ...[
                const SizedBox(height: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.photo_library_outlined,
                          size: 12, color: Colors.white70),
                      const SizedBox(width: 4),
                      Text(
                        '${mediaUrls.length}',
                        style: const TextStyle(
                            fontSize: 11, color: Colors.white70),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// No-image placeholder
// ══════════════════════════════════════════════════════════════════════════════
class _NoImagePlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return ColoredBox(
      color: colors.brandNavy,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.apartment_outlined,
                size: 56, color: Colors.white.withValues(alpha: 0.30)),
            const SizedBox(height: 8),
            Text(
              context.l10n.noProjectsTitle,
              style: TextStyle(
                  fontSize: 13, color: Colors.white.withValues(alpha: 0.45)),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Fallback header (shown during loading/error before data arrives)
// ══════════════════════════════════════════════════════════════════════════════
class _FallbackHeader extends StatelessWidget {
  const _FallbackHeader({
    required this.topPad,
    required this.title,
    this.subtitle,
  });
  final double topPad;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          AppSpacing.md, topPad + AppSpacing.sm, AppSpacing.md, AppSpacing.md),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [context.appColors.brandNavy, const Color(0xFF1A2A4A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Row(
        children: [
          _BackButton(topPad: 0),
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

// ══════════════════════════════════════════════════════════════════════════════
// Back button
// ══════════════════════════════════════════════════════════════════════════════
class _BackButton extends StatelessWidget {
  const _BackButton({required this.topPad});
  final double topPad;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          shape: BoxShape.circle,
        ),
        child: Icon(
          Directionality.of(context) == TextDirection.rtl
              ? Icons.arrow_forward_ios_rounded
              : Icons.arrow_back_ios_new_rounded,
          size: 16,
          color: Colors.white,
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Metrics strip (same component pattern as the list screen)
// ══════════════════════════════════════════════════════════════════════════════
class _MetricsStrip extends StatelessWidget {
  const _MetricsStrip({
    required this.lang,
    this.available,
    this.total,
    this.startingPrice,
    this.sold,
  });

  final String lang;
  final int? available;
  final int? total;
  final double? startingPrice;
  final int? sold;

  String _compactPrice(double price) {
    if (price >= 1e6) {
      final v = price / 1e6;
      final suffix = lang == 'ar' ? 'م' : 'M';
      return v == v.truncateToDouble()
          ? '${v.toInt()}$suffix'
          : '${v.toStringAsFixed(1)}$suffix';
    }
    if (price >= 1e3) {
      final suffix = lang == 'ar' ? 'ك' : 'K';
      return '${(price / 1e3).toInt()}$suffix';
    }
    return price.toInt().toString();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    final items = <_MetricSlot>[];
    if (available != null) {
      items.add(_MetricSlot(
          value: '$available',
          label: l10n.projectAvailableLabel,
          color: colors.success));
    }
    if (startingPrice != null) {
      items.add(_MetricSlot(
          value: _compactPrice(startingPrice!),
          label: l10n.projectStartingFrom,
          color: colors.brandGold));
    }
    if (total != null && items.length < 3) {
      items.add(_MetricSlot(
          value: '$total',
          label: l10n.projectTotalLabel,
          color: colors.inkStrong));
    }
    if (sold != null && items.length < 3) {
      items.add(_MetricSlot(
          value: '$sold',
          label: l10n.projectSoldLabel,
          color: colors.brandGold));
    }
    if (items.isEmpty) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: colors.hairline),
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            for (var i = 0; i < items.length; i++) ...[
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        items[i].value,
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          color: items[i].color,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        items[i].label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: colors.inkMuted,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
              if (i < items.length - 1)
                Container(width: 1, color: colors.hairline),
            ],
          ],
        ),
      ),
    );
  }
}

class _MetricSlot {
  const _MetricSlot(
      {required this.value, required this.label, required this.color});
  final String value;
  final String label;
  final Color color;
}

// ══════════════════════════════════════════════════════════════════════════════
// Description section with expand/collapse
// ══════════════════════════════════════════════════════════════════════════════
class _DescriptionSection extends StatefulWidget {
  const _DescriptionSection({required this.title, required this.text});
  final String title;
  final String text;

  @override
  State<_DescriptionSection> createState() => _DescriptionSectionState();
}

class _DescriptionSectionState extends State<_DescriptionSection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionTitle(title: widget.title),
        const SizedBox(height: AppSpacing.sm),
        Text(
          widget.text,
          maxLines: _expanded ? null : 4,
          overflow: _expanded ? TextOverflow.visible : TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 14,
            color: colors.ink,
            height: 1.65,
          ),
        ),
        const SizedBox(height: 6),
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
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Section title
// ══════════════════════════════════════════════════════════════════════════════
class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 3,
          height: 18,
          decoration: BoxDecoration(
            color: colors.brandGold,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          title,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: colors.inkStrong,
          ),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Unit card
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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final hasPrice = unit.price != null && unit.price!.isNotEmpty;
    final available = unit.status == 'AVAILABLE';

    return AppCard(
      padding: EdgeInsets.zero,
      onTap: () =>
          context.push('/units/${unit.id}', extra: {'projectId': projectId}),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Top: code, type, status ─────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.sm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        unit.code,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: colors.inkStrong,
                          letterSpacing: 0.3,
                        ),
                      ),
                      if (unit.type != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          unit.type!,
                          style: TextStyle(
                            fontSize: 13,
                            color: colors.inkMuted,
                          ),
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
          // ── Hairline divider ────────────────────────────────────────────────
          Divider(height: 1, thickness: 1, color: colors.hairline),
          // ── Price + specs row ───────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (hasPrice) ...[
                  Text(
                    PriceFormatter.formatString(unit.price, languageCode: lang),
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: available ? colors.brandGold : colors.inkMuted,
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
                        label: '${_formatArea(unit.area)} م²',
                      ),
                    if (unit.bedrooms != null && unit.bedrooms! > 0)
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
          // ── CTA footer ──────────────────────────────────────────────────────
          Container(
            decoration: BoxDecoration(
              color: colors.surfaceSoft,
              borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(AppRadii.md)),
            ),
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: AppSpacing.sm),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  l10n.viewUnit,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: colors.brandGold,
                  ),
                ),
                Icon(
                  Directionality.of(context) == TextDirection.rtl
                      ? Icons.arrow_back_ios_new_rounded
                      : Icons.arrow_forward_ios_rounded,
                  size: 12,
                  color: colors.brandGold,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Spec pill (icon + label, surfaceSoft background)
// ══════════════════════════════════════════════════════════════════════════════
class _SpecPill extends StatelessWidget {
  const _SpecPill({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.sm),
        border: Border.all(color: colors.hairline),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: colors.inkMuted),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: colors.inkStrong,
            ),
          ),
        ],
      ),
    );
  }
}

extension _DoubleX on double {
  T let<T>(T Function(double) fn) => fn(this);
}
