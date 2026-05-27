import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/unit.dart';

import 'price_text.dart';
import 'section_header.dart' show SpecChip;
import 'unit_status_chip.dart';

/// Premium unit card: cover image with status chip, price, type, and the
/// beds/baths/area spec row.
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

    final card = AppCard(
      padding: EdgeInsets.zero,
      elevation: AppCardElevation.card,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 16 / 10,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppNetworkImage(url: unit.coverImage),
                PositionedDirectional(
                  top: AppSpacing.sm,
                  start: AppSpacing.sm,
                  child: UnitStatusChip(unit.status, variant: BadgeVariant.solid),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  unit.project?.name.resolve(lang) ?? unit.type,
                  style: theme.textTheme.titleMedium,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  unit.type,
                  style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    SpecChip(icon: Icons.bed_outlined, value: '${unit.bedrooms}'),
                    SpecChip(icon: Icons.bathtub_outlined, value: '${unit.bathrooms}'),
                    SpecChip(
                      icon: Icons.square_foot_outlined,
                      value: context.l10n.areaValue('${unit.area}'),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                PriceText(unit.price, style: theme.textTheme.titleMedium),
              ],
            ),
          ),
        ],
      ),
    );

    return width == null ? card : SizedBox(width: width, child: card);
  }
}
