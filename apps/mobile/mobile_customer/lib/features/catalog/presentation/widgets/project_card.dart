import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/project.dart';
import 'glass.dart';

/// Luxury project card (warm-luxe, website-parity): a 16:9 image with an
/// elegant scrim, a frosted "مميز" pill and a frosted favorite action, then a
/// city line, a strong title, a two-line description excerpt, and an
/// available-units badge with a round open affordance.
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
    final l10n = context.l10n;

    final description = project.description.resolve(lang).trim();
    final city = project.city.trim();
    final units = project.availableUnitsCount;

    final card = AppCard(
      padding: EdgeInsets.zero,
      elevation: AppCardElevation.card,
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppNetworkImage(url: project.coverImage),
                const _ScrimBottom(),
                if (project.featured)
                  PositionedDirectional(
                    top: AppSpacing.sm,
                    start: AppSpacing.sm,
                    child: GlassPill(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: AppPalette.gold400,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Text(l10n.featuredBadge),
                        ],
                      ),
                    ),
                  ),
                PositionedDirectional(
                  top: AppSpacing.xs,
                  end: AppSpacing.xs,
                  child: GlassActionBar(
                    children: [FavoriteToggleButton(isProject: true, id: project.id)],
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
                if (city.isNotEmpty)
                  Row(
                    children: [
                      Icon(Icons.location_on_rounded, size: 14, color: colors.brandGold),
                      const SizedBox(width: AppSpacing.xxs),
                      Expanded(
                        child: Text(
                          city,
                          style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  _resolveTitle(lang),
                  style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (description.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    description,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: colors.inkMuted, height: 1.5),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: StatusBadge(
                          label: l10n.availableUnitsCount(units),
                          tone: units > 0 ? BadgeTone.gold : BadgeTone.neutral,
                        ),
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

  /// Title with safe fallbacks: localized name → city → a dash.
  String _resolveTitle(String lang) {
    final name = project.name.resolve(lang).trim();
    if (name.isNotEmpty) return name;
    if (project.city.trim().isNotEmpty) return project.city.trim();
    return '—';
  }
}

/// Soft bottom scrim — subtle depth under the image without darkening content.
class _ScrimBottom extends StatelessWidget {
  const _ScrimBottom();
  @override
  Widget build(BuildContext context) => const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0x33000000), Colors.transparent, Color(0x22000000)],
            stops: [0.0, 0.4, 1.0],
          ),
        ),
      );
}
