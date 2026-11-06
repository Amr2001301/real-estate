import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core.dart';


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
    this.photos = const [],
    this.photoBadge,
    this.card,
    this.actions = const [],
    this.onBack,
    this.bottomBar,
  });

  final String title;

  /// The place line under the title, on the cover.
  final String? subtitle;

  /// The cover photos (they swipe when there are several).
  final List<String> photos;

  /// A badge at the start of the cover's bottom (the unit's status, "featured").
  final Widget? photoBadge;

  /// The card laid over the cover's bottom edge (the price).
  final Widget? card;

  /// Round buttons on the cover (favourite, compare).
  final List<Widget> actions;
  final VoidCallback? onBack;
  final Widget? bottomBar;

  /// The sections. Box widgets go in [AppDetailPage.box].
  final List<Widget> slivers;

  /// Wraps a box widget as a padded sliver.
  static Widget box(Widget child, {EdgeInsetsGeometry? padding}) => SliverPadding(
        padding: padding ?? const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        sliver: SliverToBoxAdapter(child: child),
      );

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final hero = CatalogPageHero(
      photos: photos,
      badges: [?photoBadge],
      title: title,
      place: subtitle ?? '',
      height: 270,
      actions: actions,
      onBack: onBack,
    );
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: Stack(
          children: [
            CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: card == null
                      ? hero
                      : HomeOverlap(overlap: 30, top: hero, bottom: Padding(padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md), child: card!)),
                ),
                if (card != null) const SliverToBoxAdapter(child: SizedBox(height: 14)),
                ...slivers,
                SliverToBoxAdapter(child: SizedBox(height: (bottomBar != null ? 104 : AppSpacing.xxl) + bottom)),
              ],
            ),
            if (bottomBar != null) Positioned(left: 0, right: 0, bottom: 0, child: bottomBar!),
          ],
        ),
      ),
    );
  }
}

/// A section title of the detail page: a gold bar and the title.
class AppDetailSectionTitle extends StatelessWidget {
  const AppDetailSectionTitle(this.title, {super.key, this.icon = Icons.auto_awesome_rounded});
  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: AppPalette.gold50,
              border: Border.all(color: AppPalette.gold100),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 16, color: AppPalette.gold500),
          ),
          const SizedBox(width: 9),
          Expanded(child: Text(title, style: homeDisplay(18.5, context.appColors.inkStrong))),
        ],
      );
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
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
      decoration: homeCard(context, radius: 18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 21, color: AppPalette.gold500),
          const SizedBox(height: 6),
          FittedBox(fit: BoxFit.scaleDown, child: Text(value, maxLines: 1, style: homeDisplay(16, colors.inkStrong))),
          const SizedBox(height: 2),
          Text(label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
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
