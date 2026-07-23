import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/catalog_status_label.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_unit_detail_cubit.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

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
    return BlocBuilder<StaffUnitDetailCubit, StaffUnitDetailState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return Scaffold(
              appBar: AppBar(
                backgroundColor: context.appColors.brandNavy,
                foregroundColor: Colors.white,
                leading: BackButton(onPressed: () => context.pop()),
              ),
              body: const Center(child: CircularProgressIndicator()),
            );
          case DataStatus.failure:
            return Scaffold(
              appBar: AppBar(
                backgroundColor: context.appColors.brandNavy,
                foregroundColor: Colors.white,
                leading: BackButton(onPressed: () => context.pop()),
              ),
              body: ErrorState(
                failure: state.failure,
                onRetry: () => context.read<StaffUnitDetailCubit>().load(),
              ),
            );
          case DataStatus.empty:
          case DataStatus.success:
            return _DetailPage(unit: state.data!, projectId: widget.projectId);
        }
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating-sheet detail page
// ─────────────────────────────────────────────────────────────────────────────

class _DetailPage extends StatefulWidget {
  const _DetailPage({required this.unit, this.projectId});
  final StaffUnit unit;
  final String? projectId;

  static const double _heroH = 380.0;
  static const double _peekH = 48.0;

  @override
  State<_DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<_DetailPage> {
  late final ScrollController _scroll;
  double _px = 0;

  @override
  void initState() {
    super.initState();
    _scroll = ScrollController()
      ..addListener(() {
        if (mounted) {
          setState(() => _px = _scroll.offset.clamp(0.0, double.infinity));
        }
      });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  bool get _overSheet =>
      _px > (_DetailPage._heroH - _DetailPage._peekH - 56);

  @override
  Widget build(BuildContext context) {
    final unit = widget.unit;
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final effProjectId = widget.projectId ?? unit.projectId;
    final hasProject = unit.projectName != null || unit.projectCity != null;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: Stack(
          children: [
            // ── 1. Pinned hero ──────────────────────────────────────────────
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: _DetailPage._heroH + topInset,
              child: _HeroPanel(unit: unit, lang: lang),
            ),

            // ── 2. Scrollable cream sheet ───────────────────────────────────
            SingleChildScrollView(
              controller: _scroll,
              physics: const ClampingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    height: topInset +
                        _DetailPage._heroH -
                        _DetailPage._peekH,
                  ),
                  Container(
                    decoration: BoxDecoration(
                      color: colors.canvas,
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(AppRadii.xxl + 10),
                        topRight: Radius.circular(AppRadii.xxl + 10),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.20),
                          blurRadius: 36,
                          offset: const Offset(0, -8),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _SheetHandle(colors: colors),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.lg,
                            AppSpacing.xs,
                            AppSpacing.lg,
                            0,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _IdentityRow(unit: unit),
                              const SizedBox(height: AppSpacing.sm),
                              if (unit.type != null)
                                Text(
                                  unit.type!,
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineMedium
                                      ?.copyWith(
                                        fontWeight: FontWeight.w800,
                                        color: colors.inkStrong,
                                        height: 1.1,
                                      ),
                                ),
                              const SizedBox(height: AppSpacing.lg),
                              if (unit.price != null &&
                                  unit.price!.isNotEmpty) ...[
                                _PriceBlock(unit: unit, lang: lang),
                                const SizedBox(height: AppSpacing.xl),
                              ],
                              _SectionTitle(l10n.unitDetails),
                              const SizedBox(height: AppSpacing.md),
                              _SpecsRow(unit: unit),
                              if (hasProject) ...[
                                const SizedBox(height: AppSpacing.xl),
                                _SectionTitle(l10n.navProjects),
                                const SizedBox(height: AppSpacing.md),
                                _ProjectCard(unit: unit, lang: lang),
                              ],
                            ],
                          ),
                        ),
                        SizedBox(height: 180 + bottomInset),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // ── 3. Floating nav (back button) ───────────────────────────────
            Positioned(
              top: topInset,
              left: 0,
              right: 0,
              height: 68,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    _NavBtn(
                      overSheet: _overSheet,
                      child: BackButton(
                        color: _overSheet ? colors.inkStrong : Colors.white,
                        onPressed: () =>
                            context.canPop() ? context.pop() : null,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // ── 4. Sticky dock ──────────────────────────────────────────────
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: _StickyActionBar(unit: unit, effProjectId: effProjectId),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

class _HeroPanel extends StatelessWidget {
  const _HeroPanel({required this.unit, required this.lang});
  final StaffUnit unit;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final heroUrl = unit.heroImageUrl;
    final projectName = unit.projectName?.resolve(lang);
    final city = unit.projectCity;
    final locationLabel =
        [projectName, city].whereType<String>().join(' · ');

    return Stack(
      fit: StackFit.expand,
      children: [
        if (heroUrl != null)
          AppNetworkImage(url: heroUrl)
        else
          _Placeholder(),
        // Top scrim — status bar legibility
        const Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 180,
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
        // Bottom scrim — location pill readability
        const Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          height: 100,
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
        if (locationLabel.isNotEmpty)
          PositionedDirectional(
            bottom: AppSpacing.xl + 4,
            start: AppSpacing.lg,
            end: AppSpacing.lg,
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.sizeOf(context).width * 0.72,
                ),
                child: _LocationPill(label: locationLabel),
              ),
            ),
          ),
      ],
    );
  }
}

class _LocationPill extends StatelessWidget {
  const _LocationPill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
      decoration: BoxDecoration(
        color: AppPalette.navy.withValues(alpha: 0.85),
        borderRadius: AppRadii.pillAll,
        border: Border.all(color: Colors.white.withValues(alpha: 0.20)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.location_on_rounded, size: 14, color: Colors.white),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
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

// ─────────────────────────────────────────────────────────────────────────────
// Sheet chrome
// ─────────────────────────────────────────────────────────────────────────────

class _SheetHandle extends StatelessWidget {
  const _SheetHandle({required this.colors});
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10, bottom: 6),
      child: Center(
        child: Container(
          width: 36,
          height: 4,
          decoration: BoxDecoration(
            color: colors.hairline,
            borderRadius: AppRadii.pillAll,
          ),
        ),
      ),
    );
  }
}

/// Floating action button — glass (over hero) or solid surface circle (over sheet).
class _NavBtn extends StatelessWidget {
  const _NavBtn({required this.overSheet, required this.child});
  final bool overSheet;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: overSheet
            ? colors.surface
            : Colors.white.withValues(alpha: 0.18),
        shape: BoxShape.circle,
        border: Border.all(
          color: overSheet
              ? colors.hairline
              : Colors.white.withValues(alpha: 0.30),
        ),
        boxShadow: overSheet ? colors.shadowCard : null,
      ),
      child: ClipOval(
        child: IconButtonTheme(
          data: IconButtonThemeData(
            style: IconButton.styleFrom(
              minimumSize: const Size(42, 42),
              maximumSize: const Size(42, 42),
              padding: EdgeInsets.zero,
              iconSize: 20,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity + pricing
// ─────────────────────────────────────────────────────────────────────────────

class _IdentityRow extends StatelessWidget {
  const _IdentityRow({required this.unit});
  final StaffUnit unit;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        StatusBadge(
          label: unitStatusLabel(context.l10n, unit.status),
          tone: unitStatusTone(unit.status),
          variant: BadgeVariant.solid,
        ),
        Text(
          context.l10n.unitCode(unit.code),
          style: theme.textTheme.bodySmall?.copyWith(
            color: colors.inkMuted,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _PriceBlock extends StatelessWidget {
  const _PriceBlock({required this.unit, required this.lang});
  final StaffUnit unit;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.25),
        ),
      ),
      child: IntrinsicHeight(
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
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    context.l10n.unitPrice,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: colors.inkMuted,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    PriceFormatter.formatString(unit.price,
                        languageCode: lang),
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: colors.brandGold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section heading
// ─────────────────────────────────────────────────────────────────────────────

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
          height: 18,
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
              ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec chips
// ─────────────────────────────────────────────────────────────────────────────

class _SpecsRow extends StatelessWidget {
  const _SpecsRow({required this.unit});
  final StaffUnit unit;

  static String _fmtArea(String? raw) {
    final n = num.tryParse(raw ?? '');
    if (n == null) return raw ?? '';
    return n == n.truncateToDouble()
        ? n.toInt().toString()
        : n.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final stats = <(IconData, String, String)>[
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

    if (stats.isEmpty) return const SizedBox.shrink();

    return Row(
      children: [
        for (int i = 0; i < stats.length; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: _StatChip(
              icon: stats[i].$1,
              value: stats[i].$2,
              label: stats[i].$3,
            ),
          ),
        ],
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
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
        vertical: AppSpacing.md,
        horizontal: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.7)),
        boxShadow: colors.shadowCard,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 22, color: colors.brandGold),
          const SizedBox(height: 6),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: colors.inkStrong,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(color: colors.inkMuted),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Project card
// ─────────────────────────────────────────────────────────────────────────────

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
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border:
            Border.all(color: AppPalette.gold400.withValues(alpha: 0.20)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: colors.brandGoldSoft,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Icon(Icons.apartment_rounded,
                color: colors.brandGold, size: 22),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (name != null)
                  Text(
                    name,
                    style: theme.textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
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
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticky action dock
// ─────────────────────────────────────────────────────────────────────────────

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
                      AppButton(
                        label: l10n.reservationCreate,
                        icon: Icons.bookmark_add_outlined,
                        variant: available
                            ? AppButtonVariant.gold
                            : AppButtonVariant.outline,
                        size: AppButtonSize.large,
                        expand: true,
                        onPressed: available
                            ? () => context.push(
                                  '/reservations/new',
                                  extra: {'unitId': unit.id},
                                )
                            : null,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Row(
                        children: [
                          if (effProjectId != null) ...[
                            Expanded(
                              child: _GlassAction(
                                label: l10n.visitNew,
                                icon: Icons.event_outlined,
                                onTap: () => context.push(
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
