import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_colors.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';
import 'app_detail_kit.dart';
import 'app_nav_header.dart';

/// The detail page of a project or a unit, in both apps: the navy header
/// every page has (back, name, a line under it, actions), the photos in a
/// rounded card under it, then the sections, and an optional dock at the
/// bottom.
class AppDetailPage extends StatelessWidget {
  const AppDetailPage({
    super.key,
    required this.title,
    required this.slivers,
    this.subtitle,
    this.gallery,
    this.photos,
    this.photoPlaceholder,
    this.photoBadge,
    this.photoOverlay,
    this.actions = const [],
    this.onBack,
    this.bottomBar,
  });

  final String title;
  final String? subtitle;

  /// The photos (a carousel, a placeholder…), shown in a 16:10 rounded card.
  final Widget? gallery;

  /// The photos, shown by [AppPhotoGallery] (counter, thumbnails, full
  /// screen). Takes the place of [gallery] when set.
  final List<String>? photos;
  final Widget? photoPlaceholder;
  final Widget? photoBadge;
  final Widget? photoOverlay;

  /// The sections. Box widgets go in [AppDetailPage.box].
  final List<Widget> slivers;

  /// Header buttons and pills ([NavHeaderAction], [NavHeaderPill]).
  final List<Widget> actions;
  final VoidCallback? onBack;
  final Widget? bottomBar;

  /// Wraps a box widget as a padded sliver.
  static Widget box(Widget child, {EdgeInsetsGeometry? padding}) => SliverPadding(
        padding: padding ?? const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        sliver: SliverToBoxAdapter(child: child),
      );

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      backgroundColor: colors.canvas,
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              AppNavSliverHeader(
                title: title,
                subtitle: subtitle,
                leadingAction: NavHeaderBack(onTap: onBack),
                actions: actions,
              ),
              if (photos != null)
                box(
                  AppPhotoGallery(
                    images: photos!,
                    placeholder: photoPlaceholder,
                    badge: photoBadge,
                    overlay: photoOverlay,
                  ),
                  padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, 0),
                )
              else if (gallery != null)
                box(
                  Container(
                    key: const Key('detail-gallery'),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(AppRadii.xl),
                      boxShadow: colors.shadowSoft,
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(AppRadii.xl),
                      child: AspectRatio(aspectRatio: 16 / 10, child: gallery),
                    ),
                  ),
                  padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, 0),
                ),
              ...slivers,
              SliverToBoxAdapter(child: SizedBox(height: (bottomBar != null ? 104 : AppSpacing.xxl) + bottom)),
            ],
          ),
          if (bottomBar != null) Positioned(left: 0, right: 0, bottom: 0, child: bottomBar!),
        ],
      ),
    );
  }
}

/// A section title of the detail page: a gold bar and the title.
class AppDetailSectionTitle extends StatelessWidget {
  const AppDetailSectionTitle(this.title, {super.key});
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
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: colors.inkStrong),
          ),
        ),
      ],
    );
  }
}

/// One fact of the detail page (bedrooms, area…): gold icon, value, label.
class AppDetailStat extends StatelessWidget {
  const AppDetailStat({super.key, required this.icon, required this.value, required this.label});
  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md, horizontal: AppSpacing.xs),
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
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              maxLines: 1,
              style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800, color: colors.inkStrong),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(color: colors.inkMuted),
          ),
        ],
      ),
    );
  }
}

/// A row of [AppDetailStat]s, equal widths.
class AppDetailStatsRow extends StatelessWidget {
  const AppDetailStatsRow({super.key, required this.stats});
  final List<AppDetailStat> stats;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < stats.length; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.sm),
          Expanded(child: stats[i]),
        ],
      ],
    );
  }
}
