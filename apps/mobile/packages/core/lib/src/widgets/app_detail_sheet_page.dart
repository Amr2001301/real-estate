import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_colors.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';

/// The detail page of a project or a unit, in both apps: a pinned hero
/// (photos), a cream sheet that slides up over it with a handle, floating
/// round buttons (back on one side, [actions] on the other) that turn solid
/// once the sheet passes under them, and an optional dock at the bottom.
class AppDetailSheetPage extends StatefulWidget {
  const AppDetailSheetPage({
    super.key,
    required this.hero,
    required this.slivers,
    this.onBack,
    this.actions = const [],
    this.bottomBar,
    this.heroHeight = 400,
  });

  /// Fills the hero area (an image gallery, a placeholder…).
  final Widget hero;

  /// The sheet's content. Box widgets go in [AppDetailSheetPage.box].
  final List<Widget> slivers;
  final VoidCallback? onBack;

  /// Built with the current "over the sheet" state, so they can switch colour.
  final List<Widget Function(bool overSheet)> actions;
  final Widget? bottomBar;
  final double heroHeight;

  static const double _peek = 48;

  /// Wraps a box widget as a padded sheet sliver.
  static Widget box(Widget child, {EdgeInsetsGeometry? padding}) => SliverPadding(
        padding: padding ?? const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        sliver: SliverToBoxAdapter(child: child),
      );

  @override
  State<AppDetailSheetPage> createState() => _AppDetailSheetPageState();
}

class _AppDetailSheetPageState extends State<AppDetailSheetPage> {
  final _scroll = ScrollController();
  bool _overSheet = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      final over = _scroll.offset > widget.heroHeight - AppDetailSheetPage._peek - 56;
      if (over != _overSheet && mounted) setState(() => _overSheet = over);
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final top = MediaQuery.paddingOf(context).top;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: _overSheet && colors.surface.computeLuminance() > 0.2
          ? SystemUiOverlayStyle.dark
          : SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: Stack(
          children: [
            Positioned(top: 0, left: 0, right: 0, height: widget.heroHeight + top, child: widget.hero),
            CustomScrollView(
              controller: _scroll,
              physics: const ClampingScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(child: SizedBox(height: top + widget.heroHeight - AppDetailSheetPage._peek)),
                DecoratedSliver(
                  decoration: BoxDecoration(
                    color: colors.canvas,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.xxl + 10)),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.20), blurRadius: 36, offset: const Offset(0, -8)),
                    ],
                  ),
                  sliver: SliverMainAxisGroup(
                    slivers: [
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.only(top: 10, bottom: 6),
                          child: Center(
                            child: Container(
                              width: 36,
                              height: 4,
                              decoration: BoxDecoration(color: colors.hairline, borderRadius: AppRadii.pillAll),
                            ),
                          ),
                        ),
                      ),
                      ...widget.slivers,
                      SliverToBoxAdapter(child: SizedBox(height: (widget.bottomBar != null ? 104 : AppSpacing.xxl) + bottom)),
                    ],
                  ),
                ),
              ],
            ),
            Positioned(
              top: top,
              left: 0,
              right: 0,
              height: 68,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
                child: Row(
                  children: [
                    AppDetailNavButton(
                      overSheet: _overSheet,
                      // Mirrors by itself: points right in Arabic.
                      icon: Icons.arrow_back_rounded,
                      tooltip: MaterialLocalizations.of(context).backButtonTooltip,
                      onTap: widget.onBack ?? () => Navigator.of(context).maybePop(),
                    ),
                    const Spacer(),
                    for (final a in widget.actions) ...[
                      const SizedBox(width: AppSpacing.sm),
                      a(_overSheet),
                    ],
                  ],
                ),
              ),
            ),
            if (widget.bottomBar != null) Positioned(left: 0, right: 0, bottom: 0, child: widget.bottomBar!),
          ],
        ),
      ),
    );
  }
}

/// A round floating button of the detail page: glass over the photos, solid
/// once the sheet is under it.
class AppDetailNavButton extends StatelessWidget {
  const AppDetailNavButton({
    super.key,
    required this.overSheet,
    required this.icon,
    required this.onTap,
    this.tooltip,
  });

  final bool overSheet;
  final IconData icon;
  final VoidCallback onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final button = AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: overSheet ? colors.surface : Colors.white.withValues(alpha: 0.18),
        shape: BoxShape.circle,
        border: Border.all(color: overSheet ? colors.hairline : Colors.white.withValues(alpha: 0.30)),
        boxShadow: overSheet ? colors.shadowSoft : null,
      ),
      child: Icon(icon, size: 20, color: overSheet ? colors.inkStrong : Colors.white),
    );
    return Semantics(
      button: true,
      label: tooltip,
      child: GestureDetector(onTap: onTap, behavior: HitTestBehavior.opaque, child: button),
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
