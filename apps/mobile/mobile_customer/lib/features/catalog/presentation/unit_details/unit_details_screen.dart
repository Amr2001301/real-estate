import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/auth_navigation.dart';
import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/unit.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../domain/usecases/get_units.dart';
import '../compare/compare_cubit.dart';
import '../widgets/contact_buttons.dart';
import '../widgets/glass.dart';
import '../widgets/image_gallery.dart';
import '../widgets/price_text.dart';
import '../widgets/section_header.dart';
import '../widgets/unit_card.dart';
import '../widgets/unit_status_chip.dart';
import 'unit_details_cubit.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

class UnitDetailsScreen extends StatelessWidget {
  const UnitDetailsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<UnitDetailsCubit, UnitDetailsState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return Scaffold(
              appBar: AppBar(),
              body: const Center(child: CircularProgressIndicator()),
            );
          case DataStatus.failure:
          case DataStatus.empty:
            return Scaffold(
              appBar: AppBar(),
              body: ErrorState(
                failure: state.failure,
                onRetry: () => context.read<UnitDetailsCubit>().load(),
              ),
            );
          case DataStatus.success:
            return _DetailPage(unit: state.data!);
        }
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating-sheet detail page
// ─────────────────────────────────────────────────────────────────────────────

class _DetailPage extends StatefulWidget {
  const _DetailPage({required this.unit});
  final Unit unit;

  static const double _heroH = 400.0;
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
                    height: topInset + _DetailPage._heroH - _DetailPage._peekH,
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
                              Text(
                                unit.type,
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
                              _PriceBlock(unit: unit),
                              const SizedBox(height: AppSpacing.xl),
                              _SectionTitle(l10n.unitOverview),
                              const SizedBox(height: AppSpacing.md),
                              _SpecsRow(unit: unit),
                              const SizedBox(height: AppSpacing.xl),
                              _SectionTitle(l10n.unitAbout),
                              const SizedBox(height: AppSpacing.md),
                              _AboutCard(text: l10n.unitAboutGeneric),
                              if (unit.project != null) ...[
                                const SizedBox(height: AppSpacing.xl),
                                _SectionTitle(l10n.unitWithinProject),
                                const SizedBox(height: AppSpacing.md),
                                _WithinProject(project: unit.project!),
                              ],
                              const SizedBox(height: AppSpacing.xl),
                              _SectionTitle(l10n.unitPlanTitle),
                              const SizedBox(height: AppSpacing.md),
                              _UnitPlan(
                                unit: unit,
                                onRequest: () =>
                                    showUnitContactSheet(context, unit),
                              ),
                            ],
                          ),
                        ),
                        if (unit.project != null)
                          _SimilarUnits(
                            projectId: unit.project!.id,
                            currentUnitId: unit.id,
                          ),
                        SizedBox(height: 104 + bottomInset),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // ── 3. Floating nav (back + favorite + compare) ─────────────────
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
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _NavBtn(
                      overSheet: _overSheet,
                      child: BackButton(
                        color: _overSheet ? colors.inkStrong : Colors.white,
                        onPressed: () => context.canPop()
                            ? context.pop()
                            : context.go('/home'),
                      ),
                    ),
                    Row(
                      children: [
                        _NavBtn(
                          overSheet: _overSheet,
                          child: FavoriteToggleButton(
                            isProject: false,
                            id: unit.id,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        _NavBtn(
                          overSheet: _overSheet,
                          child: _CompareButton(unit: unit),
                        ),
                      ],
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
              child: _StickyActionBar(unit: unit),
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
  final Unit unit;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final project = unit.project;
    return Stack(
      fit: StackFit.expand,
      children: [
        ImageGallery(images: unit.galleryImages),
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
        if (project != null)
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
                child: _LocationPill(
                  label: '${project.name.resolve(lang)} · ${project.city}',
                ),
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
        boxShadow: overSheet ? colors.shadowSoft : null,
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
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        UnitStatusChip(unit.status),
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
  const _PriceBlock({required this.unit});
  final Unit unit;

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
                    context.l10n.labelPrice,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: colors.inkMuted,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  PriceText(
                    unit.price,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
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
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final stats = <(IconData, String, String)>[
      (Icons.bed_outlined, '${unit.bedrooms}', l10n.labelBedrooms),
      (Icons.bathtub_outlined, '${unit.bathrooms}', l10n.labelBathrooms),
      (
        Icons.square_foot_outlined,
        l10n.areaValue('${unit.area}'),
        l10n.labelArea,
      ),
      if (unit.floor != null)
        (Icons.layers_outlined, '${unit.floor}', l10n.labelFloor),
    ];

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
        boxShadow: colors.shadowSoft,
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
            style:
                theme.textTheme.labelSmall?.copyWith(color: colors.inkMuted),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Content sections
// ─────────────────────────────────────────────────────────────────────────────

class _AboutCard extends StatelessWidget {
  const _AboutCard({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
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
              child: Text(
                text,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colors.inkStrong.withValues(alpha: 0.86),
                  height: 1.6,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WithinProject extends StatelessWidget {
  const _WithinProject({required this.project});
  final UnitProjectRef project;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;
    return PremiumCard(
      glow: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const IconChip(icon: Icons.apartment_rounded),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.labelProject,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: colors.brandGold,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      project.name.resolve(lang),
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: colors.inkStrong,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Icon(Icons.location_on_rounded,
                            size: 14, color: colors.brandGold),
                        const SizedBox(width: AppSpacing.xxs),
                        Flexible(
                          child: Text(
                            project.city,
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
          const SizedBox(height: AppSpacing.md),
          const GoldHairline(),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: l10n.viewProject,
                  variant: AppButtonVariant.primary,
                  size: AppButtonSize.small,
                  onPressed: () => context.push('/projects/${project.id}'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppButton(
                  label: l10n.viewProjectUnits,
                  variant: AppButtonVariant.outline,
                  size: AppButtonSize.small,
                  onPressed: () =>
                      context.push('/projects/${project.id}/units'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _UnitPlan extends StatelessWidget {
  const _UnitPlan({required this.unit, required this.onRequest});
  final Unit unit;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final plans =
        unit.media.where((m) => m.type.toUpperCase() == 'FLOORPLAN').toList();

    if (plans.isNotEmpty) {
      return LuxeCard(
        child: AspectRatio(
          aspectRatio: 4 / 3,
          child: AppNetworkImage(url: plans.first.url, fit: BoxFit.contain),
        ),
      );
    }
    return _BlueprintCard(
      text: l10n.unitPlanOnRequest,
      ctaLabel: l10n.unitPlanRequest,
      onRequest: onRequest,
    );
  }
}

class _BlueprintCard extends StatelessWidget {
  const _BlueprintCard({
    required this.text,
    required this.ctaLabel,
    required this.onRequest,
  });
  final String text;
  final String ctaLabel;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        boxShadow: colors.shadowLift,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: Stack(
          children: [
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppPalette.navy700, AppPalette.navy],
                  ),
                ),
              ),
            ),
            const Positioned.fill(
              child: IgnorePointer(
                child: CustomPaint(painter: _BlueprintGrid()),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.lg,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        color: AppPalette.gold400.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(AppRadii.md),
                        border: Border.all(
                          color: AppPalette.gold400.withValues(alpha: 0.55),
                        ),
                      ),
                      child: const Icon(Icons.architecture_rounded,
                          color: AppPalette.gold300, size: 28),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    text,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.82),
                      height: 1.5,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _OutlineOnNavyButton(label: ctaLabel, onTap: onRequest),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OutlineOnNavyButton extends StatelessWidget {
  const _OutlineOnNavyButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.08),
      shape: StadiumBorder(
        side: BorderSide(color: Colors.white.withValues(alpha: 0.5)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 46,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.description_outlined,
                  size: 18, color: Colors.white),
              const SizedBox(width: AppSpacing.sm),
              Text(
                label,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
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

class _BlueprintGrid extends CustomPainter {
  const _BlueprintGrid();

  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..color = Colors.white.withValues(alpha: 0.05)
      ..strokeWidth = 1;
    final gold = Paint()
      ..color = AppPalette.gold400.withValues(alpha: 0.07)
      ..strokeWidth = 1;
    const step = 26.0;
    var i = 0;
    for (var x = step; x < size.width; x += step, i++) {
      canvas.drawLine(
          Offset(x, 0), Offset(x, size.height), i.isEven ? gold : line);
    }
    i = 0;
    for (var y = step; y < size.height; y += step, i++) {
      canvas.drawLine(
          Offset(0, y), Offset(size.width, y), i.isEven ? gold : line);
    }
  }

  @override
  bool shouldRepaint(_BlueprintGrid oldDelegate) => false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Similar units carousel
// ─────────────────────────────────────────────────────────────────────────────

class _SimilarUnits extends StatefulWidget {
  const _SimilarUnits({
    required this.projectId,
    required this.currentUnitId,
  });
  final String projectId;
  final String currentUnitId;

  @override
  State<_SimilarUnits> createState() => _SimilarUnitsState();
}

class _SimilarUnitsState extends State<_SimilarUnits> {
  late final Future<List<Unit>> _future = _load();

  Future<List<Unit>> _load() async {
    final result = await GetUnits(context.read<CatalogRepository>())(
      GetUnitsParams(
        projectId: widget.projectId,
        status: UnitStatus.available,
        page: 1,
        pageSize: 8,
      ),
    );
    return result.when(
      ok: (page) =>
          page.data.where((u) => u.id != widget.currentUnitId).toList(),
      err: (_) => const <Unit>[],
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return FutureBuilder<List<Unit>>(
      future: _future,
      builder: (context, snapshot) {
        final units = snapshot.data ?? const <Unit>[];
        if (snapshot.connectionState != ConnectionState.done ||
            units.isEmpty) {
          return const SizedBox.shrink();
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.xl),
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: SectionHeader(
                title: l10n.unitOtherInProject,
                onViewAll: () =>
                    context.push('/projects/${widget.projectId}/units'),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              height: 370,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                itemCount: units.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: AppSpacing.md),
                itemBuilder: (context, i) {
                  final unit = units[i];
                  return UnitCard(
                    unit: unit,
                    width: 280,
                    onTap: () => context.push('/units/${unit.id}'),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticky action dock
// ─────────────────────────────────────────────────────────────────────────────

class _StickyActionBar extends StatelessWidget {
  const _StickyActionBar({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n = context.l10n;

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
            boxShadow: colors.shadowLift,
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
                const Positioned(
                  top: 0,
                  left: AppSpacing.xl,
                  right: AppSpacing.xl,
                  child: GoldHairline(),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: AppButton(
                          label: l10n.requestVisit,
                          icon: Icons.event_available_outlined,
                          variant: AppButtonVariant.gold,
                          size: AppButtonSize.medium,
                          expand: true,
                          onPressed: () => _onRequestVisit(context),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      _GlassAction(
                        tooltip: l10n.homeAskAssistant,
                        icon: Icons.auto_awesome_rounded,
                        onTap: () => context.push('/chat'),
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

  void _onRequestVisit(BuildContext context) {
    final authed = context.read<SessionCubit>().state.isAuthenticated;
    final projectId = unit.project?.id;
    if (authed && projectId != null) {
      context.push('/visit-request', extra: {
        'projectId': projectId,
        'unitId': unit.id,
      });
    } else {
      _showVisitPrompt(context);
    }
  }

  void _showVisitPrompt(BuildContext context) {
    final l10n = context.l10n;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.requestVisit,
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpacing.xs),
            Text(l10n.requestVisitPrompt,
                style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: l10n.actionLogin,
              icon: Icons.login_rounded,
              expand: true,
              onPressed: () {
                Navigator.of(sheetContext).pop();
                context.pushLoginWithRedirect();
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            ContactButtons(whatsappMessage: '${unit.type} · ${unit.code}'),
          ],
        ),
      ),
    );
  }
}

class _GlassAction extends StatelessWidget {
  const _GlassAction({
    required this.icon,
    required this.onTap,
    required this.tooltip,
  });
  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Semantics(
        button: true,
        label: tooltip,
        child: Material(
          color: Colors.white.withValues(alpha: 0.14),
          shape: CircleBorder(
            side: BorderSide(color: Colors.white.withValues(alpha: 0.40)),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            customBorder: const CircleBorder(),
            child: SizedBox(
              width: 46,
              height: 46,
              child: Icon(icon, color: Colors.white, size: 22),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Compare toggle
// ─────────────────────────────────────────────────────────────────────────────

class _CompareButton extends StatelessWidget {
  const _CompareButton({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CompareCubit, List<Unit>>(
      builder: (context, selected) {
        final inCompare = selected.any((u) => u.id == unit.id);
        return IconButton(
          tooltip: inCompare
              ? context.l10n.compareRemove
              : context.l10n.compareAdd,
          color: context.appColors.inkStrong,
          icon: Icon(inCompare
              ? Icons.compare_arrows_rounded
              : Icons.add_to_photos_outlined),
          onPressed: () => _toggle(context),
        );
      },
    );
  }

  void _toggle(BuildContext context) {
    final l10n = context.l10n;
    final result = context.read<CompareCubit>().toggle(unit);
    final messenger = ScaffoldMessenger.of(context)..hideCurrentSnackBar();
    final text = switch (result) {
      CompareToggle.added => l10n.compareAdded,
      CompareToggle.removed => l10n.compareRemove,
      CompareToggle.full => l10n.compareFull(CompareCubit.maxItems),
    };
    messenger.showSnackBar(SnackBar(
      content: Text(text),
      action: result == CompareToggle.added
          ? SnackBarAction(
              label: l10n.compareTitle,
              onPressed: () => context.push('/compare'),
            )
          : null,
    ));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact sheet
// ─────────────────────────────────────────────────────────────────────────────

void showUnitContactSheet(BuildContext context, Unit unit) {
  final l10n = context.l10n;
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) => Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.requestInfo,
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${unit.type} · ${l10n.unitCode(unit.code)}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.appColors.inkMuted,
                ),
          ),
          const SizedBox(height: AppSpacing.lg),
          ContactButtons(whatsappMessage: '${unit.type} · ${unit.code}'),
        ],
      ),
    ),
  );
}
