import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/project.dart';
import 'glass.dart';

/// Editorial luxury project card — redesigned from scratch.
///
/// Structure:
///   • 240px cinematic hero: strong bottom gradient + ordinal number echo +
///     gold-seal featured badge + city dot + large white title
///   • Gold-start divider hairline
///   • Content block: description + units chip + CTA arrow
class ProjectCard extends StatelessWidget {
  const ProjectCard({
    super.key,
    required this.project,
    this.onTap,
    this.width,
    this.index = 0,
  });

  final ProjectListItem project;
  final VoidCallback? onTap;

  /// Fixed width for horizontal carousels; null = fill parent (list mode).
  final double? width;

  /// Zero-based list index — drives the subtle ordinal watermark on the image.
  final int index;

  static const double _imageHeight = 240;

  String _resolveTitle(String lang) {
    final name = project.name.resolve(lang).trim();
    if (name.isNotEmpty) return name;
    final city = project.city.trim();
    return city.isNotEmpty ? city : '—';
  }

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;

    final title = _resolveTitle(lang);
    final description = project.description.resolve(lang).trim();
    final city = project.city.trim();
    final units = project.availableUnitsCount;

    // Ordinal string: "01", "02", …
    final ordinal = (index + 1).toString().padLeft(2, '0');

    final card = LuxeCard(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Cinematic hero ─────────────────────────────────────────────────
          SizedBox(
            height: _imageHeight,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Cover photo
                AppNetworkImage(url: project.coverImage),

                // Cinematic gradient: subtle top vignette + heavy bottom dark
                const Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Color(0x33000000),
                          Color(0x00000000),
                          Color(0xBB000000),
                          Color(0xF2000000),
                        ],
                        stops: [0.0, 0.28, 0.66, 1.0],
                      ),
                    ),
                  ),
                ),

                // Ordinal watermark — large translucent editorial numeral
                PositionedDirectional(
                  bottom: -14,
                  end: AppSpacing.md,
                  child: Text(
                    ordinal,
                    style: TextStyle(
                      fontSize: 88,
                      fontWeight: FontWeight.w900,
                      color: Colors.white.withValues(alpha: 0.05),
                      height: 1,
                    ),
                  ),
                ),

                // Top-end: featured seal + heart side by side
                PositionedDirectional(
                  top: AppSpacing.sm,
                  end: AppSpacing.sm,
                  start: AppSpacing.sm,
                  child: Row(
                    mainAxisSize: MainAxisSize.max,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (project.featured) ...[
                        _GoldSeal(label: l10n.featuredBadge),
                        const SizedBox(width: AppSpacing.xs),
                      ],
                      GlassCircle(
                        child: FavoriteToggleButton(
                          isProject: true,
                          id: project.id,
                          dense: true,
                        ),
                      ),
                    ],
                  ),
                ),

                // Bottom overlay: city dot + title
                PositionedDirectional(
                  bottom: AppSpacing.lg,
                  start: AppSpacing.lg,
                  end: AppSpacing.lg,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (city.isNotEmpty) ...[
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                color: AppPalette.gold400,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: AppPalette.gold400.withValues(
                                      alpha: 0.6,
                                    ),
                                    blurRadius: 6,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Text(
                              city.toUpperCase(),
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: AppPalette.gold300,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.6,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xxs),
                      ],
                      Text(
                        title,
                        style: theme.textTheme.headlineMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          height: 1.1,
                          letterSpacing: -0.3,
                          shadows: const [
                            Shadow(color: Color(0x55000000), blurRadius: 10),
                          ],
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── Gold-start divider ─────────────────────────────────────────────
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
              Expanded(child: Container(height: 0.5, color: colors.hairline)),
            ],
          ),

          // ── Content area ───────────────────────────────────────────────────
          Container(
            color: colors.surface,
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (description.isNotEmpty) ...[
                  Text(
                    description,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.inkMuted,
                      height: 1.6,
                    ),
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
}

/// Solid gold-gradient featured badge — warmer and more premium than frosted
/// glass, communicates "hand-picked by our curators".
class _GoldSeal extends StatelessWidget {
  const _GoldSeal({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFC99A2E), AppPalette.gold400, Color(0xFFC99A2E)],
        ),
        borderRadius: AppRadii.pillAll,
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.45),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.star_rounded, color: Colors.white, size: 12),
          const SizedBox(width: AppSpacing.xxs),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

/// Soft-gold available-units chip.
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
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: has
            ? colors.brandGold.withValues(alpha: 0.10)
            : colors.surfaceSoft,
        borderRadius: AppRadii.pillAll,
        border: Border.all(
          color: has
              ? colors.brandGold.withValues(alpha: 0.30)
              : colors.hairline,
          width: 0.8,
        ),
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
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: fg,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
