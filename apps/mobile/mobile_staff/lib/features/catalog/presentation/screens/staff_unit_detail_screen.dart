import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/catalog_status_label.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_unit_detail_cubit.dart';

const _navyDeep = Color(0xFF0B1726);

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
                  child: _CircleBackButton(onTap: () => context.pop()),
                ),
              ),
              const Expanded(
                child: Center(
                  child: CircularProgressIndicator(color: AppPalette.gold400),
                ),
              ),
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
            child: _CircleBackButton(onTap: () => context.pop()),
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
class _DetailPage extends StatelessWidget {
  const _DetailPage({required this.unit, this.projectId});
  final StaffUnit unit;
  final String? projectId;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final effProjectId = projectId ?? unit.projectId;
    final hasProject = unit.projectName != null || unit.projectCity != null;
    final available = unit.status == 'AVAILABLE';

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        bottomNavigationBar: _StickyActionBar(
          unit: unit,
          effProjectId: effProjectId,
        ),
        body: CustomScrollView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          slivers: [
            // ── Hero ──────────────────────────────────────────────────────
            SliverAppBar(
              expandedHeight: 420,
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
                  AppSpacing.xl,
                  0,
                  AppSpacing.lg,
                  AppSpacing.md,
                ),
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
                background: _HeroBackground(unit: unit, lang: lang),
              ),
            ),

            // ── Summary card (identity + price unified) ────────────────────
            SliverToBoxAdapter(
              child: _SummaryCard(
                unit: unit,
                l10n: l10n,
                lang: lang,
                colors: colors,
                available: available,
              ),
            ),

            // ── Unit details section ───────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.xl,
                  AppSpacing.lg,
                  AppSpacing.md,
                ),
                child: _SectionTitle(l10n.unitDetails),
              ),
            ),

            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              sliver: _SpecsGrid(unit: unit, l10n: l10n),
            ),

            // ── Project section ────────────────────────────────────────────
            if (hasProject) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.xl,
                    AppSpacing.lg,
                    AppSpacing.md,
                  ),
                  child: _SectionTitle(l10n.navProjects),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                  ),
                  child: _ProjectCard(unit: unit, lang: lang),
                ),
              ),
            ],

            const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xxl)),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Hero background
// ══════════════════════════════════════════════════════════════════════════════
class _HeroBackground extends StatelessWidget {
  const _HeroBackground({required this.unit, required this.lang});
  final StaffUnit unit;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final heroUrl = unit.heroImageUrl;
    return Stack(
      fit: StackFit.expand,
      children: [
        // Image
        if (heroUrl != null) AppNetworkImage(url: heroUrl) else _Placeholder(),

        // Top gradient — protects back button
        const Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 200,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xDD000000), Color(0x00000000)],
                ),
              ),
            ),
          ),
        ),

        // Bottom gradient — behind title + location
        const Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: 200,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Color(0xF5050E18), Color(0x00000000)],
                ),
              ),
            ),
          ),
        ),

        // Status badge — top-end (opposite corner from the leading back button)
        PositionedDirectional(
          top: kToolbarHeight + 8,
          end: AppSpacing.lg,
          child: _StatusPill(
            label: unitStatusLabel(context.l10n, unit.status),
            tone: unitStatusTone(unit.status),
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

  Color _bg() => switch (tone) {
    BadgeTone.success => const Color(0xFF22C55E).withValues(alpha: 0.90),
    BadgeTone.warning => const Color(0xFFF59E0B).withValues(alpha: 0.90),
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

class _Placeholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: _navyDeep,
      child: Center(
        child: Icon(
          Icons.home_work_outlined,
          size: 64,
          color: Color(0x33FFFFFF),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Glass circle back button
// ══════════════════════════════════════════════════════════════════════════════
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
          color: Colors.white.withValues(alpha: 0.18),
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.30),
            width: 0.8,
          ),
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
// Summary card — identity + price unified
// ══════════════════════════════════════════════════════════════════════════════
class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.unit,
    required this.l10n,
    required this.lang,
    required this.colors,
    required this.available,
  });
  final StaffUnit unit;
  final AppLocalizations l10n;
  final String lang;
  final AppColorsExt colors;
  final bool available;

  Color get _accent => switch (unit.status) {
    'AVAILABLE' => colors.success,
    'RESERVED' => colors.warning,
    'SOLD' => const Color(0xFFEF4444),
    _ => colors.inkMuted,
  };

  @override
  Widget build(BuildContext context) {
    final accent = _accent;
    final hasPrice = unit.price != null && unit.price!.isNotEmpty;

    return Container(
      margin: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        0,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.xl),
        border: Border.all(color: colors.hairline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 18,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Identity row ─────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Unit code + type (start = right in RTL)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        unit.code,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: colors.inkMuted,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 3),
                      if (unit.type != null)
                        Text(
                          unit.type!,
                          style: TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w900,
                            color: colors.inkStrong,
                            letterSpacing: -0.5,
                            height: 1.1,
                          ),
                        ),
                      const SizedBox(height: 10),
                      Container(
                        width: 36,
                        height: 2.5,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppPalette.gold400, Color(0x00B8941F)],
                          ),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                // Status badge (end = left in RTL)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.10),
                    borderRadius: AppRadii.pillAll,
                    border: Border.all(
                      color: accent.withValues(alpha: 0.35),
                      width: 1.2,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: accent,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: accent.withValues(alpha: 0.6),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        unitStatusLabel(l10n, unit.status),
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: accent,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── Price row ────────────────────────────────────────────────────
          if (hasPrice) ...[
            Divider(
              height: 1,
              thickness: 0.5,
              color: colors.hairline,
              indent: AppSpacing.lg,
              endIndent: AppSpacing.lg,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.lg,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    l10n.unitPrice,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: colors.inkMuted,
                      letterSpacing: 0.5,
                    ),
                  ),
                  Text(
                    PriceFormatter.formatString(unit.price, languageCode: lang),
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      color: available ? colors.brandGold : colors.inkMuted,
                      letterSpacing: -0.5,
                      height: 1.0,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Section title
// ══════════════════════════════════════════════════════════════════════════════
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
          '${_fmtArea(unit.area)} م²',
          l10n.unitArea,
        ),
      if (unit.floor != null)
        (Icons.layers_outlined, '${unit.floor}', l10n.unitFloor),
    ];

    if (specs.isEmpty)
      return const SliverToBoxAdapter(child: SizedBox.shrink());

    // Build rows of 2
    final rows = <Widget>[];
    for (int i = 0; i < specs.length; i += 2) {
      rows.add(
        Row(
          children: [
            Expanded(
              child: _SpecCard(
                icon: specs[i].$1,
                value: specs[i].$2,
                label: specs[i].$3,
              ),
            ),
            if (i + 1 < specs.length) ...[
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _SpecCard(
                  icon: specs[i + 1].$1,
                  value: specs[i + 1].$2,
                  label: specs[i + 1].$3,
                ),
              ),
            ] else
              const Expanded(child: SizedBox.shrink()),
          ],
        ),
      );
      if (i + 2 < specs.length) rows.add(const SizedBox(height: AppSpacing.sm));
    }

    return SliverToBoxAdapter(
      child: Column(mainAxisSize: MainAxisSize.min, children: rows),
    );
  }
}

class _SpecCard extends StatelessWidget {
  const _SpecCard({
    required this.icon,
    required this.value,
    required this.label,
  });
  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.xl,
        horizontal: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
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
                color: AppPalette.gold400.withValues(alpha: 0.20),
              ),
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
              letterSpacing: 0.1,
            ),
          ),
        ],
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
class _StickyActionBar extends StatelessWidget {
  const _StickyActionBar({required this.unit, this.effProjectId});
  final StaffUnit unit;
  final String? effProjectId;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n = context.l10n;
    final available = unit.status == 'AVAILABLE';

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.xs,
          AppSpacing.lg,
          AppSpacing.sm,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.xl),
            boxShadow: colors.shadowCard,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.xl),
            child: Stack(
              children: [
                const Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [AppPalette.navy700, AppPalette.navy],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 0,
                  left: AppSpacing.xl,
                  right: AppSpacing.xl,
                  child: Container(
                    height: 1,
                    color: AppPalette.gold400.withValues(alpha: 0.35),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Reserve — AVAILABLE only
                      if (available) ...[
                        AppButton(
                          label: l10n.reservationCreate,
                          icon: Icons.bookmark_add_outlined,
                          variant: AppButtonVariant.gold,
                          size: AppButtonSize.large,
                          expand: true,
                          onPressed: () => context.push(
                            '/reservations/new',
                            extra: {'unitId': unit.id},
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                      ],

                      // Second row — hide Schedule visit for SOLD units
                      Row(
                        children: [
                          if (available && effProjectId != null ||
                              unit.status == 'RESERVED' && effProjectId != null)
                            ...[],
                          Expanded(
                            child: _GlassAction(
                              label: l10n.calculatorTitle,
                              icon: Icons.calculate_outlined,
                              onTap: () => context.push(
                                '/calculator',
                                extra: {
                                  'price': double.tryParse(unit.price ?? ''),
                                  'projectId': unit.projectId,
                                },
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GlassAction extends StatelessWidget {
  const _GlassAction({
    required this.label,
    required this.icon,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        side: BorderSide(color: Colors.white.withValues(alpha: 0.25)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 44,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 18),
              const SizedBox(width: AppSpacing.xs),
              Text(
                label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
