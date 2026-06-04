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

/// Luxury unit card (warm-luxe, website-parity): a 16:9 image with frosted
/// glass status + project pills and grouped favorite/compare actions, then a
/// type-tile + title + code-chip header, a location·floor line, a hairline
/// divider, compact gold spec stats, and the price as the anchor with a round
/// open affordance. Overflow-proof at any width.
class UnitCard extends StatelessWidget {
  const UnitCard({super.key, required this.unit, this.onTap, this.width});

  final Unit unit;
  final VoidCallback? onTap;
  final double? width;

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
    ];

    final card = AppCard(
      padding: EdgeInsets.zero,
      elevation: AppCardElevation.card,
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Image ───────────────────────────────────────────────────────
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppNetworkImage(url: unit.coverImage),
                const _TopScrim(),
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
                PositionedDirectional(
                  top: AppSpacing.xs,
                  end: AppSpacing.xs,
                  child: GlassActionBar(
                    children: [
                      _CompareButton(unit: unit),
                      FavoriteToggleButton(isProject: false, id: unit.id),
                    ],
                  ),
                ),
                if (projectName.isNotEmpty)
                  PositionedDirectional(
                    bottom: AppSpacing.sm,
                    start: AppSpacing.sm,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 200),
                      child: GlassPill(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.apartment_rounded, color: AppPalette.gold300),
                            const SizedBox(width: AppSpacing.xs),
                            Flexible(
                              child: Text(projectName,
                                  maxLines: 1, overflow: TextOverflow.ellipsis),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          // ── Content ─────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    IconChip(icon: _typeIcon(unit.type), tone: AppTone.gold, size: IconChipSize.sm),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        unit.type,
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    _CodeChip(code: unit.code),
                  ],
                ),
                if (locationParts.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Icon(Icons.location_on_rounded, size: 14, color: colors.brandGold),
                      const SizedBox(width: AppSpacing.xxs),
                      Expanded(
                        child: Text(
                          locationParts.join('  ·  '),
                          style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                  child: Divider(height: 1, color: colors.hairline),
                ),
                Wrap(
                  spacing: AppSpacing.lg,
                  runSpacing: AppSpacing.xs,
                  children: [
                    if (unit.bedrooms > 0)
                      _Spec(icon: Icons.bed_rounded, value: '${unit.bedrooms}'),
                    if (unit.bathrooms > 0)
                      _Spec(icon: Icons.bathtub_rounded, value: '${unit.bathrooms}'),
                    if (unit.area > 0)
                      _Spec(icon: Icons.square_foot_rounded, value: l10n.areaValue('${unit.area}')),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: PriceText(
                        unit.price,
                        style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
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

  IconData _typeIcon(String type) => switch (type.toLowerCase()) {
        'office' => Icons.business_center_rounded,
        'retail' => Icons.storefront_rounded,
        'villa' => Icons.villa_rounded,
        'townhouse' => Icons.holiday_village_rounded,
        _ => Icons.apartment_rounded,
      };
}

/// Top scrim so frosted pills stay legible over bright photos.
class _TopScrim extends StatelessWidget {
  const _TopScrim();
  @override
  Widget build(BuildContext context) => const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0x40000000), Colors.transparent],
            stops: [0.0, 0.35],
          ),
        ),
      );
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color});
  final Color color;
  @override
  Widget build(BuildContext context) =>
      Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
}

class _CodeChip extends StatelessWidget {
  const _CodeChip({required this.code});
  final String code;
  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Text(
        code,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.inkMuted),
      ),
    );
  }
}

/// A gold-icon + bold-value stat. Sits in a [Wrap] so it never overflows.
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
        Icon(icon, size: 16, color: colors.brandGold),
        const SizedBox(width: AppSpacing.xxs),
        Text(
          value,
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(fontWeight: FontWeight.w700, color: colors.inkStrong),
        ),
      ],
    );
  }
}

/// Compare toggle (local [CompareCubit]); works for guests.
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
          visualDensity: VisualDensity.compact,
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
