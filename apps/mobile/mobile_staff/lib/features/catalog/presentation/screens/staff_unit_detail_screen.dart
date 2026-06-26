import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/catalog_status_label.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_unit_detail_cubit.dart';

class StaffUnitDetailScreen extends StatefulWidget {
  const StaffUnitDetailScreen({super.key, this.projectId});

  /// Passed from project detail so "Schedule visit" can prefill the project.
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
    final colors = context.appColors;
    final topPad = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: BlocBuilder<StaffUnitDetailCubit, StaffUnitDetailState>(
        builder: (context, state) {
          if (state.status == DataStatus.initial ||
              state.status == DataStatus.loading) {
            return Column(
              children: [
                _NavHeader(topPad: topPad, title: context.l10n.unitDetails),
                const Expanded(
                    child: Center(child: CircularProgressIndicator())),
              ],
            );
          }
          if (state.status == DataStatus.failure) {
            return Column(
              children: [
                _NavHeader(topPad: topPad, title: context.l10n.unitDetails),
                Expanded(
                  child: ErrorState(
                    failure: state.failure,
                    onRetry: () =>
                        context.read<StaffUnitDetailCubit>().load(),
                  ),
                ),
              ],
            );
          }

          final unit = state.data!;
          return _UnitDetailBody(unit: unit, projectId: widget.projectId);
        },
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Body — scroll controller drives title fade to eliminate duplicate
// ══════════════════════════════════════════════════════════════════════════════
class _UnitDetailBody extends StatefulWidget {
  const _UnitDetailBody({required this.unit, this.projectId});
  final StaffUnit unit;
  final String? projectId;

  @override
  State<_UnitDetailBody> createState() => _UnitDetailBodyState();
}

class _UnitDetailBodyState extends State<_UnitDetailBody> {
  final _scrollController = ScrollController();
  bool _titleVisible = false;

  // Responsive hero: 27% of screen height, clamped to [200, 260]
  double _heroHeight = 220.0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final screenH = MediaQuery.of(context).size.height;
    _heroHeight = (screenH * 0.27).clamp(200.0, 260.0);
  }

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    final collapsed = _scrollController.hasClients &&
        _scrollController.offset > _heroHeight - kToolbarHeight;
    if (collapsed != _titleVisible) {
      setState(() => _titleVisible = collapsed);
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final unit = widget.unit;
    final available = unit.status == 'AVAILABLE';
    final effProjectId = widget.projectId ?? unit.projectId;

    return Column(
      children: [
        Expanded(
          child: CustomScrollView(
            controller: _scrollController,
            slivers: [
              // ── Hero app bar ───────────────────────────────────────────────
              SliverAppBar(
                expandedHeight: _heroHeight,
                pinned: true,
                backgroundColor: colors.brandNavy,
                surfaceTintColor: Colors.transparent,
                foregroundColor: Colors.white,
                automaticallyImplyLeading: false,
                leading: _BackButton(),
                // Title fades in ONLY when the hero has collapsed — fixes duplicate
                title: AnimatedOpacity(
                  opacity: _titleVisible ? 1.0 : 0.0,
                  duration: const Duration(milliseconds: 180),
                  child: Text(
                    context.l10n.unitCode(unit.code),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                flexibleSpace: FlexibleSpaceBar(
                  collapseMode: CollapseMode.pin,
                  background: _HeroImage(
                    unit: unit,
                    lang: lang,
                  ),
                ),
              ),

              // ── Compact price strip ────────────────────────────────────────
              if (unit.price != null && unit.price!.isNotEmpty)
                SliverToBoxAdapter(
                  child: _PriceStrip(
                    unit: unit,
                    lang: lang,
                    available: available,
                  ),
                ),

              // ── Specs grid ─────────────────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
                  child: _SpecsSection(unit: unit),
                ),
              ),

              // Scroll breathing room above sticky bar
              // Accounts for: top(12) + large btn(52) + gap(8) + small btn(40) + bottom(12)
              SliverToBoxAdapter(
                child: SizedBox(height: bottomPad + 148),
              ),
            ],
          ),
        ),
        // ── Sticky action bar ──────────────────────────────────────────────
        _ActionBar(
          unit: unit,
          effProjectId: effProjectId,
          bottomPad: bottomPad,
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Hero image — title only shown here (not duplicated in SliverAppBar title)
// ══════════════════════════════════════════════════════════════════════════════
class _HeroImage extends StatelessWidget {
  const _HeroImage({required this.unit, required this.lang});
  final StaffUnit unit;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final heroUrl = unit.heroImageUrl;
    final imageCount = unit.mediaUrls.isNotEmpty
        ? unit.mediaUrls.length
        : (heroUrl != null ? 1 : 0);

    return Stack(
      fit: StackFit.expand,
      children: [
        if (heroUrl != null)
          AppNetworkImage(url: heroUrl)
        else
          _Placeholder(),

        // Bottom-dominant gradient
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.transparent, Color(0xCC000000)],
              stops: [0.45, 1.0],
            ),
          ),
        ),

        // Gallery count pill — bottom trailing, only when multiple images
        if (imageCount > 1)
          PositionedDirectional(
            end: AppSpacing.md,
            bottom: AppSpacing.md,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.photo_library_outlined,
                      size: 12, color: Colors.white70),
                  const SizedBox(width: 4),
                  Text(
                    '1 / $imageCount',
                    style: const TextStyle(
                      fontSize: 11,
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),

        // Unit title at the bottom-start — the ONLY place it appears (no duplicate)
        PositionedDirectional(
          start: AppSpacing.md,
          end: imageCount > 1 ? 80 : AppSpacing.md,
          bottom: AppSpacing.md,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                context.l10n.unitCode(unit.code),
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  height: 1.2,
                  shadows: [Shadow(blurRadius: 6, color: Colors.black45)],
                ),
              ),
              if (unit.type != null)
                Text(
                  unit.type!,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.white70,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              if (unit.projectName != null || unit.projectCity != null) ...[
                const SizedBox(height: 3),
                Row(
                  children: [
                    const Icon(Icons.apartment_outlined,
                        size: 12, color: Colors.white54),
                    const SizedBox(width: 4),
                    Text(
                      [
                        unit.projectName?.resolve(lang),
                        unit.projectCity,
                      ].whereType<String>().join(' · '),
                      style: const TextStyle(
                          fontSize: 12, color: Colors.white54),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Placeholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: context.appColors.brandNavy,
      child: Center(
        child: Icon(
          Icons.home_work_outlined,
          size: 56,
          color: Colors.white.withValues(alpha: 0.20),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Compact price strip — replaces the heavy navy block
// ══════════════════════════════════════════════════════════════════════════════
class _PriceStrip extends StatelessWidget {
  const _PriceStrip(
      {required this.unit, required this.lang, required this.available});
  final StaffUnit unit;
  final String lang;
  final bool available;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n = context.l10n;
    final price = num.tryParse(unit.price!);
    final area = num.tryParse(unit.area ?? '');
    final pricePerM2 =
        (price != null && area != null && area > 0) ? price / area : null;

    return Container(
      margin: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: 8),
      decoration: BoxDecoration(
        color: available ? colors.brandNavy : colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: available ? null : Border.all(color: colors.hairline),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Price
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.unitPrice,
                  style: TextStyle(
                    fontSize: 11,
                    color: available ? Colors.white54 : colors.inkMuted,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 2),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: AlignmentDirectional.centerStart,
                  child: Text(
                    PriceFormatter.formatString(unit.price,
                        languageCode: lang),
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: available ? colors.brandGold : colors.inkStrong,
                      height: 1.1,
                    ),
                  ),
                ),
                if (pricePerM2 != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    '${l10n.pricePerMeter}: ${PriceFormatter.format(pricePerM2, languageCode: lang)}',
                    style: TextStyle(
                      fontSize: 11,
                      color: available
                          ? Colors.white.withValues(alpha: 0.45)
                          : colors.inkMuted,
                    ),
                  ),
                ],
              ],
            ),
          ),
          // Status badge — status card removed; badge integrated here
          const SizedBox(width: AppSpacing.sm),
          StatusBadge(
            label: unitStatusLabel(l10n, unit.status),
            tone: unitStatusTone(unit.status),
            variant: BadgeVariant.solid,
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Specs section — compact 2-col grid
// ══════════════════════════════════════════════════════════════════════════════
class _SpecsSection extends StatelessWidget {
  const _SpecsSection({required this.unit});
  final StaffUnit unit;

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

    final specs = <_SpecTile>[
      if (unit.area != null)
        _SpecTile(
          icon: Icons.square_foot_rounded,
          label: l10n.unitArea,
          value: '${_formatArea(unit.area)} م²',
        ),
      if (unit.bedrooms != null)
        _SpecTile(
          icon: Icons.bed_outlined,
          label: l10n.unitBedrooms,
          value: '${unit.bedrooms}',
        ),
      if (unit.bathrooms != null)
        _SpecTile(
          icon: Icons.bathtub_outlined,
          label: l10n.unitBathrooms,
          value: '${unit.bathrooms}',
        ),
      if (unit.floor != null)
        _SpecTile(
          icon: Icons.layers_outlined,
          label: l10n.unitFloor,
          value: '${unit.floor}',
        ),
      if (unit.type != null)
        _SpecTile(
          icon: Icons.home_outlined,
          label: l10n.unitType,
          value: unit.type!,
        ),
      if (unit.projectCity != null)
        _SpecTile(
          icon: Icons.location_on_outlined,
          label: '',
          value: unit.projectCity!,
        ),
    ];

    if (specs.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _SectionLabel(title: l10n.unitDetails),
        const SizedBox(height: 4),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          crossAxisSpacing: 4,
          mainAxisSpacing: 4,
          childAspectRatio: 3.8,
          children: specs.map((s) => _SpecCard(tile: s)).toList(),
        ),
      ],
    );
  }
}

class _SpecTile {
  const _SpecTile(
      {required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;
}

class _SpecCard extends StatelessWidget {
  const _SpecCard({required this.tile});
  final _SpecTile tile;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.xs),
        border: Border.all(color: colors.hairline),
      ),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: colors.brandGoldSoft,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Icon(tile.icon, size: 13, color: colors.brandGold),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (tile.label.isNotEmpty)
                  Text(
                    tile.label,
                    style: TextStyle(fontSize: 9, color: colors.inkMuted),
                  ),
                Text(
                  tile.value,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: colors.inkStrong,
                    height: 1.1,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
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
// Sticky action bar
// ══════════════════════════════════════════════════════════════════════════════
class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.unit,
    required this.effProjectId,
    required this.bottomPad,
  });
  final StaffUnit unit;
  final String? effProjectId;
  final double bottomPad;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final available = unit.status == 'AVAILABLE';

    return Container(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        bottomPad > 0 ? bottomPad : AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.hairline)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Primary
          AppButton(
            label: l10n.reservationCreate,
            icon: Icons.bookmark_add_outlined,
            size: AppButtonSize.large,
            variant:
                available ? AppButtonVariant.gold : AppButtonVariant.outline,
            onPressed: available
                ? () => context.push(
                      '/reservations/new',
                      extra: {'unitId': unit.id},
                    )
                : null,
          ),
          const SizedBox(height: AppSpacing.xs),
          // Secondary row
          Row(
            children: [
              if (effProjectId != null) ...[
                Expanded(
                  child: AppButton(
                    label: l10n.visitNew,
                    icon: Icons.event_outlined,
                    size: AppButtonSize.medium,
                    variant: AppButtonVariant.outline,
                    onPressed: () => context.push(
                      '/visits/new',
                      extra: {
                        'projectId': effProjectId,
                        'unitId': unit.id,
                      },
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
              ],
              Expanded(
                child: AppButton(
                  label: l10n.calculatorTitle,
                  icon: Icons.calculate_outlined,
                  size: AppButtonSize.medium,
                  variant: AppButtonVariant.outline,
                  onPressed: () => context.push(
                    '/calculator',
                    extra: {'price': double.tryParse(unit.price ?? '')},
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Fallback header (loading / error)
// ══════════════════════════════════════════════════════════════════════════════
class _NavHeader extends StatelessWidget {
  const _NavHeader({required this.topPad, required this.title});
  final double topPad;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          AppSpacing.sm, topPad + AppSpacing.sm, AppSpacing.md, AppSpacing.sm),
      color: context.appColors.brandNavy,
      child: Row(
        children: [
          _BackButton(),
          const SizedBox(width: AppSpacing.sm),
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 17,
              fontWeight: FontWeight.w700,
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
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          size: 16,
          color: Colors.white,
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Section label
// ══════════════════════════════════════════════════════════════════════════════
class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          decoration: BoxDecoration(
            color: colors.brandGold,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 7),
        Text(
          title,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: colors.inkStrong,
          ),
        ),
      ],
    );
  }
}
