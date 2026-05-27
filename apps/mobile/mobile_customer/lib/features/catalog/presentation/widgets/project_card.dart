import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/project.dart';

/// Premium project card: cover image with gradient scrim, featured badge,
/// name, city, and available-units count.
class ProjectCard extends StatelessWidget {
  const ProjectCard({
    super.key,
    required this.project,
    this.onTap,
    this.width,
  });

  final ProjectListItem project;
  final VoidCallback? onTap;

  /// Fixed width for horizontal carousels; null = fill parent.
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
                AppNetworkImage(url: project.coverImage),
                // Bottom scrim for legibility.
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        colors.brandNavy.withValues(alpha: 0.55),
                      ],
                    ),
                  ),
                ),
                if (project.featured)
                  const PositionedDirectional(
                    top: AppSpacing.sm,
                    start: AppSpacing.sm,
                    child: StatusBadge(
                      label: 'FEATURED',
                      tone: BadgeTone.gold,
                      variant: BadgeVariant.solid,
                    ),
                  ),
                PositionedDirectional(
                  bottom: AppSpacing.sm,
                  start: AppSpacing.sm,
                  end: AppSpacing.sm,
                  child: Row(
                    children: [
                      Icon(Icons.location_on_rounded,
                          size: 16, color: colors.brandGold),
                      const SizedBox(width: AppSpacing.xxs),
                      Expanded(
                        child: Text(
                          project.city,
                          style: theme.textTheme.labelMedium
                              ?.copyWith(color: Colors.white),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
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
                  project.name.resolve(lang),
                  style: theme.textTheme.titleLarge,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  context.l10n.availableUnitsCount(project.availableUnitsCount),
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: colors.inkMuted),
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
