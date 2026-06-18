import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/unit.dart';
import '../compare/compare_cubit.dart';
import 'glass.dart';
import 'price_text.dart';
import 'unit_status_chip.dart';

/// Premium editorial unit card — redesigned from scratch.
///
/// Structure:
///   • 210px cinematic hero: gradient + status pill (start) + actions (end) +
///     project-name/floor overlay at bottom
///   • Gold-start divider (matches ProjectCard visual language)
///   • Content: type (large) | code badge | price (gold headline) |
///     location | spec pills + arrow CTA
class UnitCard extends StatelessWidget {
  const UnitCard({
    super.key,
    required this.unit,
    this.onTap,
    this.width,
    this.index = 0,
  });

  final Unit unit;
  final VoidCallback? onTap;

  /// Fixed width for carousels; null = fill parent (list mode).
  final double? width;

  /// List index — reserved for future entrance-animation offset.
  final int index;

  static const double _imageHeight = 210;

  Color _statusColor(AppColorsExt c, UnitStatus s) => switch (s) {
        UnitStatus.available => c.success,
        UnitStatus.reserved => c.warning,
        UnitStatus.sold => c.inkMuted,
        UnitStatus.unknown => c.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;

    final projectName = unit.project?.name.resolve(lang).trim() ?? '';
    final city = unit.project?.city.trim() ?? '';

    final locationParts = <String>[
      if (city.isNotEmpty) city,
      if (unit.floor != null) '${l10n.labelFloor} ${unit.floor}',
      unit.code,
    ];

    final card = LuxeCard(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Cinematic hero ───────────────────────────────────────────────
          SizedBox(
            height: _imageHeight,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppNetworkImage(url: unit.coverImage),

                // Gradient: light vignette top → transparent mid → dark bottom
                const Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Color(0x44000000),
                          Color(0x00000000),
                          Color(0xAA000000),
                          Color(0xEE000000),
                        ],
                        stops: [0.0, 0.30, 0.68, 1.0],
                      ),
                    ),
                  ),
                ),

                // Status pill — top-start (right in RTL)
                if (unit.status != UnitStatus.unknown)
                  PositionedDirectional(
                    top: AppSpacing.sm,
                    start: AppSpacing.sm,
                    child: _StatusPill(
                      status: unit.status,
                      color: _statusColor(colors, unit.status),
                      label: unit.status.label(l10n),
                    ),
                  ),

                // Actions — top-end (left in RTL): heart + compare side by side
                PositionedDirectional(
                  top: AppSpacing.sm,
                  end: AppSpacing.sm,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      GlassCircle(
                        child: FavoriteToggleButton(
                          isProject: false,
                          id: unit.id,
                          dense: true,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      GlassCircle(child: _CompareButton(unit: unit)),
                    ],
                  ),
                ),

                // Project name + floor — bottom overlay
                PositionedDirectional(
                  bottom: AppSpacing.md,
                  start: AppSpacing.md,
                  end: AppSpacing.md,
                  child: Row(
                    children: [
                      if (projectName.isNotEmpty) ...[
                        const Icon(
                          Icons.apartment_rounded,
                          size: 13,
                          color: AppPalette.gold300,
                        ),
                        const SizedBox(width: AppSpacing.xxs),
                        Expanded(
                          child: Text(
                            projectName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ] else
                        const Spacer(),
                      if (unit.floor != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.xs + 2,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.35),
                            borderRadius: BorderRadius.circular(AppRadii.xs),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.25),
                              width: 0.6,
                            ),
                          ),
                          child: Text(
                            '${l10n.labelFloor} ${unit.floor}',
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── Gold-start divider (matches ProjectCard language) ─────────────
          Row(
            children: [
              Container(
                width: 52,
                height: 2,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppPalette.gold400, Color(0x00B8941F)],
                  ),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Expanded(
                child: Container(height: 0.5, color: colors.hairline),
              ),
            ],
          ),

          // ── Content ───────────────────────────────────────────────────────
          Container(
            color: colors.surface,
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Unit type + unit code badge
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Text(
                        unit.type,
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: colors.inkStrong,
                          height: 1.1,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    _CodeBadge(code: unit.code, colors: colors, theme: theme),
                  ],
                ),
                const SizedBox(height: AppSpacing.xxs + 2),
                // Price — the visual hero of the content area
                PriceText(
                  unit.price,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: colors.brandGold,
                    letterSpacing: -0.3,
                  ),
                ),
                if (locationParts.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    children: [
                      Icon(
                        Icons.location_on_rounded,
                        size: 13,
                        color: colors.brandGold,
                      ),
                      const SizedBox(width: AppSpacing.xxs),
                      Expanded(
                        child: Text(
                          locationParts.join('  ·  '),
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: colors.inkMuted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                // Spec pills + CTA arrow
                Row(
                  children: [
                    if (unit.bedrooms > 0) ...[
                      _SpecPill(
                        icon: Icons.bed_rounded,
                        value: '${unit.bedrooms}',
                        colors: colors,
                        theme: theme,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                    ],
                    if (unit.bathrooms > 0) ...[
                      _SpecPill(
                        icon: Icons.bathtub_rounded,
                        value: '${unit.bathrooms}',
                        colors: colors,
                        theme: theme,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                    ],
                    if (unit.area > 0)
                      _SpecPill(
                        icon: Icons.square_foot_rounded,
                        value: l10n.areaValue('${unit.area}'),
                        colors: colors,
                        theme: theme,
                      ),
                    const Spacer(),
                    const CardOpenArrow(),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );

    return width == null ? card : SizedBox(width: width, child: card);
  }
}

/// Frosted-glass status pill with a colored dot — more readable on dark images
/// than the generic GlassPill treatment.
class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.status,
    required this.color,
    required this.label,
  });

  final UnitStatus status;
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.38),
        borderRadius: AppRadii.pillAll,
        border: Border.all(
          color: color.withValues(alpha: 0.55),
          width: 0.8,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.6),
                  blurRadius: 4,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact pill showing the unit's reference code.
class _CodeBadge extends StatelessWidget {
  const _CodeBadge({
    required this.code,
    required this.colors,
    required this.theme,
  });

  final String code;
  final AppColorsExt colors;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xs + 2,
        vertical: 3,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: AppRadii.pillAll,
        border: Border.all(color: colors.hairline, width: 0.8),
      ),
      child: Text(
        code,
        style: theme.textTheme.labelSmall?.copyWith(
          color: colors.inkMuted,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

/// Pill-style spec chip: gold icon + bold value, rounded container.
class _SpecPill extends StatelessWidget {
  const _SpecPill({
    required this.icon,
    required this.value,
    required this.colors,
    required this.theme,
  });

  final IconData icon;
  final String value;
  final AppColorsExt colors;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs + 1, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.sm),
        border: Border.all(color: colors.hairline, width: 0.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: colors.brandGold),
          const SizedBox(width: 3),
          Text(
            value,
            style: theme.textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: colors.inkStrong,
            ),
          ),
        ],
      ),
    );
  }
}

/// Compare toggle (local [CompareCubit]); compact for the on-image glass circle.
class _CompareButton extends StatelessWidget {
  const _CompareButton({required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n = context.l10n;
    return BlocBuilder<CompareCubit, List<Unit>>(
      builder: (context, units) {
        final inCompare = units.any((u) => u.id == unit.id);
        return IconButton(
          iconSize: 19,
          padding: EdgeInsets.zero,
          visualDensity: VisualDensity.compact,
          constraints: const BoxConstraints.tightFor(width: 38, height: 38),
          tooltip: l10n.compareTitle,
          icon: Icon(
            inCompare
                ? Icons.check_circle_rounded
                : Icons.compare_arrows_rounded,
            color: inCompare ? colors.brandGold : null,
          ),
          onPressed: () {
            final result = context.read<CompareCubit>().toggle(unit);
            if (result == CompareToggle.full) {
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(SnackBar(
                  content: Text(l10n.compareFull(CompareCubit.maxItems)),
                ));
            }
          },
        );
      },
    );
  }
}
