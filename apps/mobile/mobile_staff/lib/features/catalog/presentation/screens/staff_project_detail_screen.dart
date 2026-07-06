import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/catalog_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_project_detail_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);

// Hero height and sheet overlap
const double _heroH = 390.0;
const double _sheetPeek = 40.0;
// Sheet corner radius matching customer app
const double _sheetRadius = 42.0;

class StaffProjectDetailScreen extends StatefulWidget {
  const StaffProjectDetailScreen({super.key, this.fallback});
  final StaffProject? fallback;

  @override
  State<StaffProjectDetailScreen> createState() =>
      _StaffProjectDetailScreenState();
}

class _StaffProjectDetailScreenState extends State<StaffProjectDetailScreen> {
  String? _unitStatusFilter;
  late final ScrollController _scroll;
  double _px = 0;
  final _unitsSectionKey = GlobalKey();

  bool get _overSheet {
    final topInset = MediaQuery.paddingOf(context).top;
    return _px > (_heroH - _sheetPeek - topInset - 56);
  }

  // True once the sheet scrolls far enough that the identity block
  // (project name) would reach the status-bar unsafe area.
  bool get _showHeader => _px > (_heroH - _sheetPeek + 28);

  @override
  void initState() {
    super.initState();
    _scroll = ScrollController()
      ..addListener(() {
        if (mounted) setState(() => _px = _scroll.offset);
      });
    context.read<StaffProjectDetailCubit>().load();
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
      value: (_overSheet && !_showHeader)
          ? SystemUiOverlayStyle.dark
          : SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: BlocBuilder<StaffProjectDetailCubit, StaffProjectDetailState>(
          builder: (context, state) {
            // ── Loading ────────────────────────────────────────────────────────
            if (state.status == DataStatus.initial ||
                state.status == DataStatus.loading) {
              return _LoadingView(
                topInset: topInset,
                fallback: widget.fallback,
                lang: lang,
                l10n: l10n,
              );
            }

            // ── Error ──────────────────────────────────────────────────────────
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

            // ── Success ────────────────────────────────────────────────────────
            final detail = state.data!;
            final p = detail.project;
            final description = detail.description?.resolve(lang);
            final name = p.name.resolve(lang);
            final allUnits = detail.units;

            final units = _unitStatusFilter == null
                ? allUnits
                : allUnits
                    .where((u) => u.status == _unitStatusFilter)
                    .toList();

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

            return Stack(
              children: [
                // ── 1. Fixed hero image ────────────────────────────────────────
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  height: _heroH + topInset,
                  child: _HeroPanel(
                    project: p,
                    statusLabel: projectStatusLabel(l10n, p.status),
                    statusTone: projectStatusTone(p.status),
                    topInset: topInset,
                  ),
                ),

                // ── 2. Scrollable content sheet ────────────────────────────────
                SingleChildScrollView(
                  controller: _scroll,
                  physics: const ClampingScrollPhysics(),
                  child: Column(
                    children: [
                      // Transparent spacer — hero shows through here
                      SizedBox(
                        height:
                            topInset + _heroH - _sheetPeek,
                      ),

                      // The floating rounded sheet
                      Container(
                        decoration: BoxDecoration(
                          color: colors.canvas,
                          borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(_sheetRadius),
                            topRight: Radius.circular(_sheetRadius),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.22),
                              blurRadius: 32,
                              spreadRadius: 2,
                              offset: const Offset(0, -10),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Drag handle
                            _SheetHandle(colors: colors),

                            // Identity
                            Padding(
                              padding: const EdgeInsets.fromLTRB(
                                  AppSpacing.xl,
                                  AppSpacing.md,
                                  AppSpacing.xl,
                                  0),
                              child: _IdentityBlock(
                                name: name,
                                city: p.city,
                                statusLabel:
                                    projectStatusLabel(l10n, p.status),
                                statusTone: projectStatusTone(p.status),
                              ),
                            ),

                            // Staff action chips
                            Padding(
                              padding: const EdgeInsets.fromLTRB(
                                  AppSpacing.xl,
                                  AppSpacing.lg,
                                  AppSpacing.xl,
                                  0),
                              child: _StaffActions(
                                onScrollToUnits: () {
                                  final ctx =
                                      _unitsSectionKey.currentContext;
                                  if (ctx != null) {
                                    Scrollable.ensureVisible(
                                      ctx,
                                      duration: const Duration(
                                          milliseconds: 350),
                                      curve: Curves.easeInOut,
                                    );
                                  }
                                },
                              ),
                            ),

                            // Stat tiles
                            if (availCount != null ||
                                totalCount != null ||
                                startingPrice != null) ...[
                              Padding(
                                padding: const EdgeInsets.fromLTRB(
                                    AppSpacing.xl,
                                    AppSpacing.xl,
                                    AppSpacing.xl,
                                    0),
                                child: _StatTiles(
                                  available: availCount,
                                  total: totalCount,
                                  startingPrice: startingPrice,
                                  lang: lang,
                                  l10n: l10n,
                                ),
                              ),
                            ],

                            // About
                            if (description != null &&
                                description.isNotEmpty) ...[
                              const SizedBox(height: AppSpacing.xxl),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: AppSpacing.xl),
                                child: _Section(
                                  title: l10n.projectAbout,
                                  child: _AboutBlock(text: description),
                                ),
                              ),
                            ],

                            // Units section
                            const SizedBox(height: AppSpacing.xxl),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.xl),
                              child: _Section(
                                key: _unitsSectionKey,
                                title: l10n.navUnits,
                                child: const SizedBox.shrink(),
                              ),
                            ),
                            if (allUnits.isNotEmpty) ...[
                              Padding(
                                padding: const EdgeInsets.fromLTRB(
                                    AppSpacing.xl,
                                    0,
                                    AppSpacing.xl,
                                    AppSpacing.sm),
                                child: AppFilterPills<String?>(
                                  allLabel: l10n.leadsFilterAll,
                                  selected: _unitStatusFilter,
                                  onSelected: (v) => setState(
                                      () => _unitStatusFilter = v),
                                  options: const [
                                    FilterPillOption(
                                        value: 'AVAILABLE',
                                        label: 'متاحة'),
                                    FilterPillOption(
                                        value: 'RESERVED',
                                        label: 'محجوزة'),
                                    FilterPillOption(
                                        value: 'SOLD', label: 'مباعة'),
                                  ],
                                ),
                              ),
                            ],

                            // Unit cards
                            if (units.isEmpty)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: AppSpacing.xl,
                                    vertical: AppSpacing.lg),
                                child: Center(
                                  child: Text(
                                    l10n.unitsEmptyMessage,
                                    style: TextStyle(
                                        fontSize: 14,
                                        color: colors.inkMuted),
                                  ),
                                ),
                              )
                            else
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: AppSpacing.xl),
                                child: Column(
                                  children: [
                                    for (var i = 0;
                                        i < units.length;
                                        i++) ...[
                                      _UnitCard(
                                          unit: units[i],
                                          projectId: p.id),
                                      if (i < units.length - 1)
                                        const SizedBox(
                                            height: AppSpacing.sm),
                                    ],
                                  ],
                                ),
                              ),

                            SizedBox(height: bottomInset + 100),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // ── 3. Adaptive nav overlay ───────────────────────────────────
                // Glass circle → surface circle → pinned navy header as user scrolls.
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: _NavOverlay(
                    topInset: topInset,
                    overSheet: _overSheet,
                    showHeader: _showHeader,
                    title: name,
                    onBack: () => context.pop(),
                    colors: colors,
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
// Fallback header (shown only during loading / error)
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
// Hero panel (fixed behind the sheet)
// ══════════════════════════════════════════════════════════════════════════════
class _HeroPanel extends StatelessWidget {
  const _HeroPanel({
    required this.project,
    required this.statusLabel,
    required this.statusTone,
    required this.topInset,
  });

  final StaffProject project;
  final String statusLabel;
  final BadgeTone statusTone;
  final double topInset;

  String? get _heroUrl =>
      project.coverImageUrl ??
      (project.mediaUrls.isNotEmpty ? project.mediaUrls.first : null);

  @override
  Widget build(BuildContext context) {
    final heroUrl = _heroUrl;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Image
        if (heroUrl != null)
          AppNetworkImage(url: heroUrl)
        else
          _NoImagePlaceholder(),

        // Top scrim — protects nav button
        const Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 140,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xB0000000), Color(0x00000000)],
                ),
              ),
            ),
          ),
        ),

        // Bottom scrim — blends into sheet's rounded corners
        const Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: 120,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Color(0x88000000), Color(0x00000000)],
                ),
              ),
            ),
          ),
        ),

        // Status + media count pills at bottom
        PositionedDirectional(
          bottom: _sheetPeek + 16,
          start: AppSpacing.xl,
          end: AppSpacing.xl,
          child: Row(
            children: [
              _StatusPill(
                  label: statusLabel, tone: statusTone),
              const Spacer(),
              if (project.mediaUrls.length > 1)
                _MediaCountPill(count: project.mediaUrls.length),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.tone});
  final String label;
  final BadgeTone tone;

  Color _bgColor() {
    switch (tone) {
      case BadgeTone.success:
        return const Color(0xFF22C55E).withValues(alpha: 0.85);
      case BadgeTone.warning:
        return const Color(0xFFF59E0B).withValues(alpha: 0.85);
      case BadgeTone.neutral:
      default:
        return Colors.black.withValues(alpha: 0.45);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: _bgColor(),
        borderRadius: AppRadii.pillAll,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.25),
          width: 0.8,
        ),
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

class _MediaCountPill extends StatelessWidget {
  const _MediaCountPill({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.40),
        borderRadius: AppRadii.pillAll,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.28),
          width: 0.8,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.photo_library_outlined,
              size: 12, color: Colors.white70),
          const SizedBox(width: 4),
          Text(
            '$count',
            style: const TextStyle(
                fontSize: 11, color: Colors.white70),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// No-image placeholder
// ══════════════════════════════════════════════════════════════════════════════
class _NoImagePlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: _navyDeep,
      child: Center(
        child: Icon(
          Icons.apartment_outlined,
          size: 64,
          color: Colors.white.withValues(alpha: 0.25),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Sheet drag handle
// ══════════════════════════════════════════════════════════════════════════════
class _SheetHandle extends StatelessWidget {
  const _SheetHandle({required this.colors});
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 44,
        height: 4,
        margin: const EdgeInsets.only(top: AppSpacing.sm + 2),
        decoration: BoxDecoration(
          color: colors.hairline,
          borderRadius: BorderRadius.circular(999),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Adaptive nav overlay
// Three states as user scrolls:
//   1. Over hero       → glass circle button, white icon
//   2. Over sheet      → surface circle button, inkStrong icon
//   3. showHeader      → full-width navy bar with project title
// ══════════════════════════════════════════════════════════════════════════════
class _NavOverlay extends StatelessWidget {
  const _NavOverlay({
    required this.topInset,
    required this.overSheet,
    required this.showHeader,
    required this.title,
    required this.onBack,
    required this.colors,
  });

  final double topInset;
  final bool overSheet;
  final bool showHeader;
  final String title;
  final VoidCallback onBack;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final backIcon = isRtl
        ? Icons.arrow_forward_ios_rounded
        : Icons.arrow_back_ios_new_rounded;

    // When in header mode: full-width navy bar with back button + title.
    // Otherwise: just a floating circle button positioned at the start corner.
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeInOut,
      color: showHeader ? _navyDeep : Colors.transparent,
      height: topInset + kToolbarHeight,
      padding: EdgeInsets.only(top: topInset),
      child: Row(
        children: [
          const SizedBox(width: AppSpacing.sm),
          // Back button — always present
          GestureDetector(
            onTap: onBack,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: showHeader
                    ? Colors.white.withValues(alpha: 0.12)
                    : overSheet
                        ? colors.surface
                        : Colors.white.withValues(alpha: 0.18),
                shape: BoxShape.circle,
                border: Border.all(
                  color: showHeader
                      ? Colors.white.withValues(alpha: 0.20)
                      : overSheet
                          ? colors.hairline
                          : Colors.white.withValues(alpha: 0.32),
                  width: 0.8,
                ),
                boxShadow:
                    (!showHeader && overSheet) ? colors.shadowSoft : null,
              ),
              child: Center(
                child: Icon(
                  backIcon,
                  size: 18,
                  color: (!showHeader && overSheet)
                      ? colors.inkStrong
                      : Colors.white,
                ),
              ),
            ),
          ),
          // Project title — only visible in header mode
          AnimatedOpacity(
            opacity: showHeader ? 1.0 : 0.0,
            duration: const Duration(milliseconds: 180),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Identity block (name, city, status, gold separator)
// ══════════════════════════════════════════════════════════════════════════════
class _IdentityBlock extends StatelessWidget {
  const _IdentityBlock({
    required this.name,
    required this.city,
    required this.statusLabel,
    required this.statusTone,
  });

  final String name;
  final String? city;
  final String statusLabel;
  final BadgeTone statusTone;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Name + status badge on the same row
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                name,
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: colors.inkStrong,
                  height: 1.1,
                  letterSpacing: -0.5,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: StatusBadge(
                label: statusLabel,
                tone: statusTone,
                variant: BadgeVariant.solid,
              ),
            ),
          ],
        ),

        // City
        if (city != null) ...[
          const SizedBox(height: AppSpacing.xs + 2),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.location_on_rounded,
                  size: 15, color: AppPalette.gold400),
              const SizedBox(width: 4),
              Text(
                city!,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colors.inkMuted,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],

        // Gold separator line
        const SizedBox(height: AppSpacing.lg),
        Container(
          width: 48,
          height: 2,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppPalette.gold400, Color(0x00B8941F)],
            ),
            borderRadius: BorderRadius.circular(999),
          ),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Staff action chips
// ══════════════════════════════════════════════════════════════════════════════
class _StaffActions extends StatelessWidget {
  const _StaffActions({required this.onScrollToUnits});
  final VoidCallback onScrollToUnits;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    // 2×2 grid — all actions visible, no horizontal scroll needed.
    return Column(
      children: [
        // Primary row
        Row(
          children: [
            Expanded(
              child: _ActionChip(
                icon: Icons.share_rounded,
                label: l10n.staffShareWithClient,
                bgColor: colors.brandGold.withValues(alpha: 0.08),
                fgColor: colors.brandGold,
                border: Border.all(
                  color: colors.brandGold.withValues(alpha: 0.55),
                  width: 1.2,
                ),
                onTap: () {},
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: _ActionChip(
                icon: Icons.person_add_rounded,
                label: l10n.staffAddInterestedClient,
                bgColor: colors.brandNavy,
                fgColor: Colors.white,
                onTap: () {},
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        // Secondary row
        Row(
          children: [
            Expanded(
              child: _ActionChip(
                icon: Icons.grid_view_rounded,
                label: l10n.viewUnits,
                bgColor: colors.surfaceSoft,
                fgColor: colors.inkStrong,
                border: Border.all(color: colors.hairline),
                onTap: onScrollToUnits,
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: _ActionChip(
                icon: Icons.edit_rounded,
                label: l10n.staffEditProject,
                bgColor: colors.surfaceSoft,
                fgColor: colors.inkMuted,
                border: Border.all(color: colors.hairline),
                onTap: () {},
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.icon,
    required this.label,
    required this.bgColor,
    required this.fgColor,
    required this.onTap,
    this.border,
  });

  final IconData icon;
  final String label;
  final Color bgColor;
  final Color fgColor;
  final BoxBorder? border;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: AppRadii.pillAll,
          border: border,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 15, color: fgColor),
            const SizedBox(width: AppSpacing.xs - 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: fgColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Stat tiles — 3 individual surface cards with gold top accent bar
// ══════════════════════════════════════════════════════════════════════════════
class _StatTiles extends StatelessWidget {
  const _StatTiles({
    required this.lang,
    required this.l10n,
    this.available,
    this.total,
    this.startingPrice,
  });

  final String lang;
  final AppLocalizations l10n;
  final int? available;
  final int? total;
  final double? startingPrice;

  String _compactPrice(double price) {
    final currency = lang == 'ar' ? ' ج.م' : ' EGP';
    if (price >= 1e6) {
      final v = price / 1e6;
      final suffix = lang == 'ar' ? 'م' : 'M';
      final numStr = v == v.truncateToDouble()
          ? '${v.toInt()}$suffix'
          : '${v.toStringAsFixed(1)}$suffix';
      return '$numStr$currency';
    }
    if (price >= 1e3) {
      final suffix = lang == 'ar' ? 'ك' : 'K';
      return '${(price / 1e3).toInt()}$suffix$currency';
    }
    return '${price.toInt()}$currency';
  }

  @override
  Widget build(BuildContext context) {
    final l = l10n;
    final stats = <(IconData, String, String, Color)>[];
    final colors = context.appColors;

    if (available != null) {
      stats.add((
        Icons.meeting_room_outlined,
        '$available',
        l.projectAvailableLabel,
        colors.success,
      ));
    }
    if (startingPrice != null) {
      stats.add((
        Icons.sell_outlined,
        _compactPrice(startingPrice!),
        l.projectStartingFrom,
        colors.brandGold,
      ));
    }
    if (total != null) {
      stats.add((
        Icons.apartment_outlined,
        '$total',
        l.projectTotalLabel,
        colors.inkStrong,
      ));
    }

    if (stats.isEmpty) return const SizedBox.shrink();

    return Row(
      children: [
        for (var i = 0; i < stats.length; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: _StatCard(
              icon: stats[i].$1,
              value: stats[i].$2,
              label: stats[i].$3,
              valueColor: stats[i].$4,
            ),
          ),
        ],
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.value,
    required this.label,
    required this.valueColor,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Gold top accent bar
          ClipRRect(
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(AppRadii.lg - 1),
              topRight: Radius.circular(AppRadii.lg - 1),
            ),
            child: Container(
              height: 2.5,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppPalette.gold300, AppPalette.gold500],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.xs,
                AppSpacing.md,
                AppSpacing.xs,
                AppSpacing.md),
            child: Column(
              children: [
                Icon(icon, size: 24, color: colors.brandGold),
                const SizedBox(height: 10),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: valueColor,
                    letterSpacing: -0.3,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: colors.inkMuted,
                  ),
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
    final colors = context.appColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
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
        ),
        if (child is! SizedBox) ...[
          const SizedBox(height: AppSpacing.md + 2),
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

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Gold left bar (directional start side)
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
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.inkStrong.withValues(alpha: 0.85),
                      height: 1.75,
                    ),
                  ),
                ),
              ],
            ),
          ),
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
      ),
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
    final isRtl = Directionality.of(context) == TextDirection.rtl;

    return AppCard(
      padding: EdgeInsets.zero,
      onTap: () =>
          context.push('/units/${unit.id}', extra: {'projectId': projectId}),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top: code + type + status
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.sm),
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
                              fontSize: 13, color: colors.inkMuted),
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
          Divider(height: 1, thickness: 1, color: colors.hairline),
          // Price + specs
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (hasPrice) ...[
                  Text(
                    PriceFormatter.formatString(unit.price,
                        languageCode: lang),
                    style: TextStyle(
                      fontSize: 19,
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
                        label: '${_formatArea(unit.area)} م²',
                      ),
                    if (unit.bedrooms != null && unit.bedrooms! > 0)
                      _SpecPill(
                        icon: Icons.bed_outlined,
                        label:
                            '${unit.bedrooms} ${l10n.unitBedrooms}',
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
            decoration: BoxDecoration(
              color: colors.surfaceSoft,
              borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(AppRadii.md)),
            ),
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      l10n.viewUnit,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: colors.brandGold,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xxs),
                    Icon(
                      isRtl
                          ? Icons.arrow_back_ios_new_rounded
                          : Icons.arrow_forward_ios_rounded,
                      size: 12,
                      color: colors.brandGold,
                    ),
                  ],
                ),
                if (available)
                  GestureDetector(
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                            content: Text(l10n.staffSendToClient)),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm, vertical: 5),
                      decoration: BoxDecoration(
                        borderRadius: AppRadii.pillAll,
                        border: Border.all(
                          color: colors.brandGold
                              .withValues(alpha: 0.45),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.send_rounded,
                            size: 13,
                            color: colors.brandGold
                                .withValues(alpha: 0.85),
                          ),
                          const SizedBox(width: AppSpacing.xxs),
                          Text(
                            l10n.staffSendToClient,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: colors.brandGold
                                  .withValues(alpha: 0.85),
                            ),
                          ),
                        ],
                      ),
                    ),
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
