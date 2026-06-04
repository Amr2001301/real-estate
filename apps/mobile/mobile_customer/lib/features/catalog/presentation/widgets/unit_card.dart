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

/// Executive unit card (hard reset): a compact 178px cover with the building
/// name + availability + actions composed onto the image, then a dense content
/// block — title and price share one anchor row, a single metadata line, and a
/// specs + CTA row. No divider, no price label, no large white zones.
class UnitCard extends StatelessWidget {
  const UnitCard({super.key, required this.unit, this.onTap, this.width});

  final Unit unit;
  final VoidCallback? onTap;
  final double? width;

  static const double _imageHeight = 178;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;

    final projectName = unit.project?.name.resolve(lang).trim() ?? '';
    final city = unit.project?.city.trim() ?? '';
    final metaParts = <String>[
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
          // ── Image (compact, info composed on it) ────────────────────────
          SizedBox(
            height: _imageHeight,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppNetworkImage(url: unit.coverImage),
                const ImageScrim(),
                // Actions grouped on the visual LEFT (end in RTL).
                PositionedDirectional(
                  top: AppSpacing.sm,
                  end: AppSpacing.sm,
                  child: Row(
                    children: [
                      GlassCircle(
                        child: FavoriteToggleButton(
                            isProject: false, id: unit.id, dense: true),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      GlassCircle(child: _CompareButton(unit: unit)),
                    ],
                  ),
                ),
                // Availability on the visual RIGHT (start in RTL).
                if (unit.status != UnitStatus.unknown)
                  PositionedDirectional(
                    top: AppSpacing.sm,
                    start: AppSpacing.sm,
                    child: GlassPill(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _Dot(color: _statusColor(colors, unit.status)),
                          const SizedBox(width: AppSpacing.xs),
                          Text(unit.status.label(l10n)),
                        ],
                      ),
                    ),
                  ),
                if (projectName.isNotEmpty)
                  PositionedDirectional(
                    bottom: AppSpacing.sm,
                    start: AppSpacing.md,
                    end: AppSpacing.md,
                    child: Row(
                      children: [
                        const Icon(Icons.apartment_rounded,
                            size: 14, color: AppPalette.gold300),
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
                      ],
                    ),
                  ),
              ],
            ),
          ),
          // Subtle gold accent between image and content.
          const GoldHairline(),
          // ── Content (dense, subtle warm tint) ───────────────────────────
          Container(
            width: double.infinity,
            color: Color.lerp(colors.surface, colors.surfaceSoft, 0.5),
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title + price share the anchor row.
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Text(
                        unit.type,
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: colors.inkStrong,
                          fontSize: 21,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    PriceText(
                      unit.price,
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800, fontSize: 18),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  children: [
                    Icon(Icons.location_on_rounded, size: 14, color: colors.brandGold),
                    const SizedBox(width: AppSpacing.xxs),
                    Expanded(
                      child: Text(
                        metaParts.join('  ·  '),
                        style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                // Specs + CTA share one row.
                Row(
                  children: [
                    Expanded(
                      child: Wrap(
                        spacing: AppSpacing.md,
                        runSpacing: AppSpacing.xs,
                        children: [
                          if (unit.bedrooms > 0)
                            _Spec(icon: Icons.bed_rounded, value: '${unit.bedrooms}'),
                          if (unit.bathrooms > 0)
                            _Spec(icon: Icons.bathtub_rounded, value: '${unit.bathrooms}'),
                          if (unit.area > 0)
                            _Spec(
                                icon: Icons.square_foot_rounded,
                                value: l10n.areaValue('${unit.area}')),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
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

  Color _statusColor(AppColorsExt c, UnitStatus s) => switch (s) {
        UnitStatus.available => c.success,
        UnitStatus.reserved => c.warning,
        UnitStatus.sold => c.inkMuted,
        UnitStatus.unknown => c.inkMuted,
      };
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color});
  final Color color;
  @override
  Widget build(BuildContext context) =>
      Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
}

/// A compact gold-icon + bold-value stat. In a [Wrap] so it never overflows.
class _Spec extends StatelessWidget {
  const _Spec({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: colors.brandGold),
        const SizedBox(width: AppSpacing.xxs),
        Text(
          value,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: colors.inkStrong,
              ),
        ),
      ],
    );
  }
}

/// Compare toggle (local [CompareCubit]); works for guests. Compact for the
/// on-image glass circle.
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
            inCompare ? Icons.check_circle_rounded : Icons.compare_arrows_rounded,
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
