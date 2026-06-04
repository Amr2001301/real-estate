import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/project.dart';
import 'glass.dart';

/// Executive project card (hard reset): an editorial hero — the city and the
/// project title are composed over a 200px cover (with a frosted "مميز" pill
/// and a small favorite) — then a tight content block of a 2-line description
/// and a footer (soft-gold units chip + refined CTA). Minimal white area.
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

  static const double _imageHeight = 200;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;

    final description = project.description.resolve(lang).trim();
    final city = project.city.trim();
    final units = project.availableUnitsCount;

    final card = LuxeCard(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Editorial hero: city + title over the image ─────────────────
          SizedBox(
            height: _imageHeight,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppNetworkImage(url: project.coverImage),
                const ImageScrim(),
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
                  top: AppSpacing.sm,
                  end: AppSpacing.sm,
                  child: GlassCircle(
                    child: FavoriteToggleButton(
                        isProject: true, id: project.id, dense: true),
                  ),
                ),
                PositionedDirectional(
                  bottom: AppSpacing.md,
                  start: AppSpacing.md,
                  end: AppSpacing.md,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (city.isNotEmpty)
                        Row(
                          children: [
                            const Icon(Icons.location_on_rounded,
                                size: 14, color: AppPalette.gold300),
                            const SizedBox(width: AppSpacing.xxs),
                            Expanded(
                              child: Text(
                                city,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.labelMedium?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.9),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        _resolveTitle(lang),
                        style: theme.textTheme.headlineSmall?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 23,
                          height: 1.1,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Subtle gold accent between image and content.
          const GoldHairline(),
          // ── Content (tight, subtle warm tint) ───────────────────────────
          Container(
            width: double.infinity,
            color: Color.lerp(colors.surface, colors.surfaceSoft, 0.5),
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (description.isNotEmpty) ...[
                  Text(
                    description,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: colors.inkMuted, height: 1.5),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
                Row(
                  children: [
                    Expanded(
                      child: Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: _UnitsChip(count: units),
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

/// Soft-gold "available units" chip (icon + count); the card's single warm
/// accent, muted when nothing is available.
class _UnitsChip extends StatelessWidget {
  const _UnitsChip({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final has = count > 0;
    final fg = has ? colors.brandGold : colors.inkMuted;
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: has
            ? colors.brandGold.withValues(alpha: 0.12)
            : colors.surfaceSoft,
        borderRadius: AppRadii.pillAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(AppIcons.property, size: 15, color: fg),
          const SizedBox(width: AppSpacing.xxs),
          Flexible(
            child: Text(
              context.l10n.availableUnitsCount(count),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context)
                  .textTheme
                  .labelMedium
                  ?.copyWith(color: fg, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
