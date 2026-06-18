import 'dart:math' as math;

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/unit.dart';
import '../widgets/unit_status_chip.dart';
import 'compare_cubit.dart';

// Navy depth tokens — match the projects/units screen language.
const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);

/// Premium compare screen — from-scratch redesign.
///
/// States:
///   • empty   → cinematic header + illustrated empty state + CTAs
///   • 1 unit  → matrix + "add more" hint + add-unit CTA
///   • 2–4     → full aligned comparison matrix
class CompareScreen extends StatelessWidget {
  const CompareScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<CompareCubit, List<Unit>>(
          builder: (context, units) {
            if (units.isEmpty) return const _CompareEmptyView();
            return _CompareContent(units: units);
          },
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Has-units layout
// ─────────────────────────────────────────────────────────────────────────────

class _CompareContent extends StatelessWidget {
  const _CompareContent({required this.units});
  final List<Unit> units;

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final dockClear = context.isApplePlatform ? bottomInset + 60 : 16.0;
    final l10n = context.l10n;
    final canAdd = units.length < CompareCubit.maxItems;

    return CustomScrollView(
      slivers: [
        SliverPersistentHeader(
          pinned: true,
          delegate: _CompareHeaderDelegate(topInset: topInset),
        ),
        SliverPadding(
          padding: EdgeInsets.fromLTRB(
              AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, dockClear),
          sliver: SliverList.list(
            children: [
              if (units.length < CompareCubit.minToCompare)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: Text(
                    l10n.compareNeedMore,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: context.appColors.inkMuted,
                        ),
                  ),
                ),
              _UnitIdentityRow(units: units),
              const SizedBox(height: AppSpacing.sm),
              _CompareMatrix(units: units),
              if (canAdd) ...[
                const SizedBox(height: AppSpacing.lg),
                _AddUnitCard(
                  text: l10n.compareAddUnit,
                  onTap: () => context.go('/units?compare=true'),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsing navy header (same pattern as projects / units screens)
// ─────────────────────────────────────────────────────────────────────────────

class _CompareHeaderDelegate extends SliverPersistentHeaderDelegate {
  const _CompareHeaderDelegate({required this.topInset});
  final double topInset;

  static const double _barH = 56.0;

  @override
  double get minExtent => topInset + _barH;
  @override
  double get maxExtent => topInset + _barH;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    final l10n = context.l10n;
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_navyDeep, _navyMid],
        ),
        border: Border(
          bottom: BorderSide(
            color: Color(0x4DB8941F), // gold shimmer hairline
            width: 0.5,
          ),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.only(top: topInset),
        child: SizedBox(
          height: _barH,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Row(
              children: [
                // Back button or fixed-width spacer for visual balance
                if (Navigator.canPop(context))
                  SizedBox(
                    width: 40,
                    child: IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new_rounded,
                          size: 17, color: Colors.white),
                      onPressed: () => Navigator.maybePop(context),
                      padding: EdgeInsets.zero,
                    ),
                  )
                else
                  const SizedBox(width: 40),

                // Centred title
                Expanded(
                  child: Text(
                    l10n.compareTitle,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 17,
                      letterSpacing: -0.2,
                    ),
                  ),
                ),

                // Clear-all — reactive so it hides when list drains to empty
                BlocBuilder<CompareCubit, List<Unit>>(
                  builder: (context, units) => SizedBox(
                    width: 52,
                    child: units.isEmpty
                        ? const SizedBox.shrink()
                        : TextButton(
                            onPressed: () =>
                                context.read<CompareCubit>().clear(),
                            style: TextButton.styleFrom(
                              foregroundColor: AppPalette.gold300,
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(40, 40),
                            ),
                            child: Text(
                              l10n.clearFilters,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                              ),
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(_CompareHeaderDelegate old) =>
      old.topInset != topInset;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit identity cards row
// ─────────────────────────────────────────────────────────────────────────────

class _UnitIdentityRow extends StatelessWidget {
  const _UnitIdentityRow({required this.units});
  final List<Unit> units;

  static const double _labelW = 64.0;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(width: _labelW),
          for (final unit in units)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: _IdentityCard(unit: unit),
              ),
            ),
        ],
      ),
    );
  }
}

/// Navy gradient identity card per compared unit: remove button + project +
/// type + code + a centred gold accent line at the bottom.
class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final project = unit.project?.name.resolve(lang).trim() ?? '';
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1E3A62), AppPalette.navy, _navyDeep],
        ),
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.18),
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.30),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.xs, AppSpacing.xs, AppSpacing.xs, AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Remove × — anchored to start edge
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: _RemoveButton(
              onTap: () => context.read<CompareCubit>().remove(unit.id),
            ),
          ),
          const SizedBox(height: AppSpacing.xxs),
          // Project name
          if (project.isNotEmpty) ...[
            Text(
              project,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: theme.textTheme.labelSmall?.copyWith(
                color: AppPalette.gold200,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(height: 2),
          ],
          // Unit type
          Text(
            unit.type,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: theme.textTheme.titleSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 1),
          // Unit code
          Text(
            unit.code,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: theme.textTheme.labelSmall?.copyWith(
              color: Colors.white.withValues(alpha: 0.50),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          // Centred gold accent line
          Container(
            width: 28,
            height: 1.5,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [
                  Color(0x00B8941F),
                  AppPalette.gold400,
                  Color(0x00B8941F),
                ],
              ),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Attribute comparison matrix
// ─────────────────────────────────────────────────────────────────────────────

class _CompareMatrix extends StatelessWidget {
  const _CompareMatrix({required this.units});
  final List<Unit> units;

  static const double _labelW = 64.0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final compare = units.length >= 2;

    // Best-value cues (only meaningful with ≥ 2 units).
    final prices = units.map((u) => num.tryParse(u.price)).whereType<num>();
    final num? minPrice =
        compare && prices.isNotEmpty ? prices.reduce(math.min) : null;
    final num? maxArea =
        compare ? units.map((u) => u.area).reduce(math.max) : null;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.8)),
        boxShadow: colors.shadowSoft,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        child: Column(
          children: [
            _AttrRow(
              icon: Icons.circle_rounded,
              label: l10n.filterStatus,
              labelW: _labelW,
              striped: false,
              cells: [
                for (final u in units)
                  Align(
                    alignment: Alignment.center,
                    child: UnitStatusChip(u.status),
                  ),
              ],
            ),
            _AttrRow(
              icon: Icons.payments_outlined,
              label: l10n.labelPrice,
              labelW: _labelW,
              striped: true,
              cells: [
                for (final u in units)
                  _PriceCell(
                    text: PriceFormatter.formatCompactString(
                      u.price,
                      languageCode: lang,
                    ),
                    best: minPrice != null &&
                        num.tryParse(u.price) == minPrice,
                  ),
              ],
            ),
            _AttrRow(
              icon: Icons.square_foot_rounded,
              label: l10n.labelArea,
              labelW: _labelW,
              striped: false,
              cells: [
                for (final u in units)
                  _ValueText(
                    l10n.areaValue('${u.area}'),
                    best: maxArea != null && u.area == maxArea,
                  ),
              ],
            ),
            _AttrRow(
              icon: Icons.bed_rounded,
              label: l10n.labelBedrooms,
              labelW: _labelW,
              striped: true,
              cells: [for (final u in units) _ValueText('${u.bedrooms}')],
            ),
            _AttrRow(
              icon: Icons.bathtub_rounded,
              label: l10n.labelBathrooms,
              labelW: _labelW,
              striped: false,
              cells: [for (final u in units) _ValueText('${u.bathrooms}')],
            ),
            _AttrRow(
              icon: Icons.layers_rounded,
              label: l10n.labelFloor,
              labelW: _labelW,
              striped: true,
              cells: [
                for (final u in units)
                  _ValueText(u.floor?.toString() ?? '—'),
              ],
            ),
            _AttrRow(
              icon: Icons.location_on_outlined,
              label: l10n.labelCity,
              labelW: _labelW,
              striped: false,
              last: true,
              cells: [
                for (final u in units)
                  _ValueText(
                    (u.project?.city.trim().isNotEmpty ?? false)
                        ? u.project!.city
                        : '—',
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// One attribute row: icon + label on the start side, one value cell per unit.
class _AttrRow extends StatelessWidget {
  const _AttrRow({
    required this.icon,
    required this.label,
    required this.labelW,
    required this.cells,
    this.striped = false,
    this.last = false,
  });

  final IconData icon;
  final String label;
  final double labelW;
  final List<Widget> cells;
  final bool striped;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: striped
            ? colors.surfaceSoft.withValues(alpha: 0.5)
            : Colors.transparent,
        border: last
            ? null
            : Border(
                bottom: BorderSide(
                    color: colors.hairline.withValues(alpha: 0.6)),
              ),
      ),
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm, vertical: AppSpacing.sm + 1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Label column: icon above text, centred
          SizedBox(
            width: labelW - AppSpacing.sm,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 14, color: colors.inkMuted),
                const SizedBox(height: 2),
                Text(
                  label,
                  maxLines: 2,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: colors.inkMuted,
                    fontWeight: FontWeight.w600,
                    fontSize: 10,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          // Value cells — one per unit column
          for (final cell in cells)
            Expanded(child: Center(child: cell)),
        ],
      ),
    );
  }
}

/// Bold value text; gold + pill when it's the "best" in the row.
class _ValueText extends StatelessWidget {
  const _ValueText(this.text, {this.best = false});
  final String text;
  final bool best;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final child = Text(
      text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      textAlign: TextAlign.center,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: best ? colors.brandGold : colors.inkStrong,
            fontWeight: FontWeight.w700,
          ),
    );
    return best ? _GoldPill(child: child) : child;
  }
}

/// Price cell: gold bold value; soft gold pill highlights the lowest price.
class _PriceCell extends StatelessWidget {
  const _PriceCell({required this.text, required this.best});
  final String text;
  final bool best;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final value = FittedBox(
      fit: BoxFit.scaleDown,
      child: Text(
        text,
        maxLines: 1,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: colors.brandGold,
              fontWeight: FontWeight.w800,
            ),
      ),
    );
    return best ? _GoldPill(child: value) : value;
  }
}

/// Soft gold rounded pill — flags the "best" value in a row.
class _GoldPill extends StatelessWidget {
  const _GoldPill({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 3),
      decoration: BoxDecoration(
        color: context.appColors.brandGoldSoft,
        borderRadius: AppRadii.pillAll,
      ),
      child: child,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Add unit card
// ─────────────────────────────────────────────────────────────────────────────

class _AddUnitCard extends StatelessWidget {
  const _AddUnitCard({required this.text, required this.onTap});
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                colors.brandGold.withValues(alpha: 0.09),
                colors.brandGold.withValues(alpha: 0.04),
              ],
            ),
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: Border.all(
              color: colors.brandGold.withValues(alpha: 0.38),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 30,
                height: 30,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.brandGold.withValues(alpha: 0.14),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: colors.brandGold.withValues(alpha: 0.38),
                    width: 0.8,
                  ),
                ),
                child: Icon(Icons.add_rounded, size: 17, color: colors.brandGold),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                text,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: colors.brandGold,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

class _CompareEmptyView extends StatelessWidget {
  const _CompareEmptyView();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final colors = context.appColors;
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Column(
      children: [
        _EmptyHeader(topInset: topInset, title: l10n.compareTitle),
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
                AppSpacing.xl,
                AppSpacing.xxl,
                AppSpacing.xl,
                context.isApplePlatform ? bottomInset + 60 : 16.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const _CompareIllustration(),
                const SizedBox(height: AppSpacing.xxl),
                Text(
                  l10n.compareEmptyTitle,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: colors.inkStrong,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.compareEmptyMessage,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: colors.inkMuted,
                    height: 1.6,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxl),
                const _HowItWorks(),
                const SizedBox(height: AppSpacing.xxl),
                AppButton(
                  label: l10n.compareSelectUnits,
                  icon: Icons.add_rounded,
                  variant: AppButtonVariant.gold,
                  expand: true,
                  onPressed: () => context.go('/units?compare=true'),
                ),
                const SizedBox(height: AppSpacing.sm),
                AppButton(
                  label: l10n.compareBrowseUnits,
                  icon: Icons.grid_view_rounded,
                  variant: AppButtonVariant.outline,
                  expand: true,
                  onPressed: () => context.go('/units'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Compact navy header used in the empty state (no clear button needed).
class _EmptyHeader extends StatelessWidget {
  const _EmptyHeader({required this.topInset, required this.title});
  final double topInset;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_navyDeep, _navyMid],
        ),
        border: Border(
          bottom: BorderSide(color: Color(0x4DB8941F), width: 0.5),
        ),
      ),
      padding: EdgeInsets.only(top: topInset),
      child: SizedBox(
        height: 56,
        child: Center(
          child: Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 17,
              letterSpacing: -0.2,
            ),
          ),
        ),
      ),
    );
  }
}

/// Three-step how-it-works strip: gold icon tiles with numbered gold badges
/// and a hairline chevron connector between each step.
class _HowItWorks extends StatelessWidget {
  const _HowItWorks();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final rtl = Directionality.of(context) == TextDirection.rtl;

    final steps = [
      (Icons.touch_app_outlined, l10n.compareStepSelect),
      (Icons.layers_outlined, l10n.compareStepLimit),
      (Icons.compare_arrows_rounded, l10n.compareStepCompare),
    ];

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          _Step(
            icon: steps[i].$1,
            label: steps[i].$2,
            stepNumber: i + 1,
            colors: colors,
          ),
          if (i < steps.length - 1)
            Padding(
              padding: const EdgeInsets.only(
                  top: AppSpacing.lg, bottom: AppSpacing.xl),
              child: Icon(
                rtl
                    ? Icons.chevron_left_rounded
                    : Icons.chevron_right_rounded,
                size: 20,
                color: colors.hairline,
              ),
            ),
        ],
      ],
    );
  }
}

/// A single step tile: gold icon container with a numbered gold badge.
class _Step extends StatelessWidget {
  const _Step({
    required this.icon,
    required this.label,
    required this.stepNumber,
    required this.colors,
  });

  final IconData icon;
  final String label;
  final int stepNumber;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 52,
                height: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      colors.brandGold.withValues(alpha: 0.15),
                      colors.brandGold.withValues(alpha: 0.06),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  border: Border.all(
                    color: colors.brandGold.withValues(alpha: 0.28),
                  ),
                ),
                child: Icon(icon, size: 24, color: colors.brandGold),
              ),
              // Numbered gold circle badge
              PositionedDirectional(
                top: -7,
                end: -7,
                child: Container(
                  width: 20,
                  height: 20,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppPalette.gold300, AppPalette.gold500],
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x44B8941F),
                        blurRadius: 6,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Text(
                    '$stepNumber',
                    style: const TextStyle(
                      color: AppPalette.navy,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colors.inkMuted,
                  fontWeight: FontWeight.w600,
                  height: 1.3,
                ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Illustration
// ─────────────────────────────────────────────────────────────────────────────

/// Two overlapping mini unit cards (one navy, one cream) with a central gold
/// compare badge — an on-brand "compare two properties" motif.
class _CompareIllustration extends StatelessWidget {
  const _CompareIllustration();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return SizedBox(
      height: 170,
      width: 240,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Soft gold halo
          Container(
            width: 160,
            height: 160,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  colors.brandGold.withValues(alpha: 0.14),
                  colors.brandGold.withValues(alpha: 0.0),
                ],
              ),
            ),
          ),
          Align(
            alignment: const Alignment(-0.6, 0),
            child: Transform.rotate(
              angle: -0.13,
              child: const _MiniCard(navy: true),
            ),
          ),
          Align(
            alignment: const Alignment(0.6, 0),
            child: Transform.rotate(
              angle: 0.13,
              child: const _MiniCard(navy: false),
            ),
          ),
          const _CompareBadge(),
        ],
      ),
    );
  }
}

class _MiniCard extends StatelessWidget {
  const _MiniCard({required this.navy});
  final bool navy;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final fg = navy ? Colors.white : colors.inkStrong;
    final line =
        (navy ? Colors.white : colors.inkMuted).withValues(alpha: 0.28);
    return Container(
      width: 104,
      height: 138,
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        gradient: navy
            ? const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF1E3A62), AppPalette.navy],
              )
            : null,
        color: navy ? null : colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: navy
            ? Border.all(
                color: AppPalette.gold400.withValues(alpha: 0.18),
                width: 0.8)
            : Border.all(color: colors.hairline.withValues(alpha: 0.9)),
        boxShadow: colors.shadowCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.apartment_rounded, size: 22, color: AppPalette.gold300),
          const Spacer(),
          for (var i = 0; i < 3; i++) ...[
            Container(
              height: 6,
              width: i == 0 ? 60 : (i == 1 ? 44 : 52),
              decoration: BoxDecoration(
                color: i == 0
                    ? AppPalette.gold400.withValues(alpha: 0.85)
                    : line,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            if (i < 2) const SizedBox(height: 6),
          ],
          const SizedBox(height: 2),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: Icon(
              Icons.favorite_border_rounded,
              size: 12,
              color: fg.withValues(alpha: 0.45),
            ),
          ),
        ],
      ),
    );
  }
}

class _CompareBadge extends StatelessWidget {
  const _CompareBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 58,
      height: 58,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppPalette.gold300, AppPalette.gold500],
        ),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.45),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: const Icon(Icons.compare_arrows_rounded,
          color: AppPalette.navy, size: 28),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Remove button
// ─────────────────────────────────────────────────────────────────────────────

/// Translucent frosted-glass × button on the navy identity card.
class _RemoveButton extends StatelessWidget {
  const _RemoveButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.14),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Tooltip(
          message: context.l10n.compareRemove,
          child: const SizedBox(
            width: 26,
            height: 26,
            child: Icon(Icons.close_rounded, size: 14, color: Colors.white),
          ),
        ),
      ),
    );
  }
}
