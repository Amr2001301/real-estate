import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core.dart';


/// A reusable navy-gradient screen header for non-catalog screens.
///
/// Used by the staff app dashboard, profile, notifications, and broker screens.
/// Provides consistent brand presence without the catalog-specific affordances.
///
/// Layout (top → bottom):
///   - Dot texture overlay (faint white grid)
///   - Gold radial bloom at the end corner
///   - Gold shimmer hairline at the bottom edge
///   - SafeArea content: [leadingAction] row + title + optional subtitle
///   - Optional [bottom] widget below the title (e.g. stats row, filter row)
class AppNavHeader extends StatelessWidget {
  const AppNavHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.leadingAction,
    this.actions = const [],
    this.bottom,
    this.avatarWidget,
    this.compact = false,
  });

  final String title;
  final String? subtitle;
  final Widget? leadingAction;
  final List<Widget> actions;
  final Widget? bottom;

  /// Optional avatar / icon widget shown at the start of the content row.
  final Widget? avatarWidget;

  /// When true, the title and [leadingAction] appear in the same row instead
  /// of [leadingAction] above and title below. Use for simple back-nav screens.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    // One look in both apps: the staff app's list header.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: HomeListHero(
        title: title,
        subtitle: subtitle,
        leading: leadingAction ?? avatarWidget,
        actions: actions,
        bottom: bottom,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Glass action button (for use inside AppNavHeader actions)
// ─────────────────────────────────────────────────────────────────────────────

/// A glass-style icon button for use inside [AppNavHeader] actions.
/// Provides 40×40 tap target with a subtle white-glass surface.
class NavHeaderAction extends StatelessWidget {
  const NavHeaderAction({
    super.key,
    required this.icon,
    required this.onTap,
    this.tooltip,
    this.badge,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? tooltip;

  /// Optional badge widget positioned top-right of the icon.
  final Widget? badge;

  @override
  Widget build(BuildContext context) {
    Widget button = Material(
      color: Colors.white.withValues(alpha: 0.10),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.20),
              width: 0.8,
            ),
          ),
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              Icon(icon, color: Colors.white, size: 20),
              if (badge != null)
                PositionedDirectional(
                  top: 4,
                  end: 4,
                  child: badge!,
                ),
            ],
          ),
        ),
      ),
    );

    if (tooltip != null) {
      button = Tooltip(message: tooltip!, child: button);
    }
    return Semantics(button: true, label: tooltip, child: button);
  }
}

/// The one back button of every header in both apps: a glass circle with a
/// chevron that points the way back in either reading direction. Pops the
/// route, or goes to [fallbackLocation] (through [onFallback]) when there is
/// nothing to pop (a screen opened from a link or a notification).
class NavHeaderBack extends StatelessWidget {
  const NavHeaderBack({super.key, this.onTap, this.onFallback});

  /// Replaces the default pop.
  final VoidCallback? onTap;

  /// Called instead of popping when the route cannot be popped.
  final VoidCallback? onFallback;

  @override
  Widget build(BuildContext context) {
    return NavHeaderAction(
      icon: Icons.arrow_back_rounded,
      tooltip: MaterialLocalizations.of(context).backButtonTooltip,
      onTap: onTap ??
          () {
            final navigator = Navigator.of(context);
            if (navigator.canPop()) {
              navigator.maybePop();
            } else {
              onFallback?.call();
            }
          },
    );
  }
}

/// Compact gold unread-count badge for [NavHeaderAction].
class NavHeaderBadge extends StatelessWidget {
  const NavHeaderBadge({super.key, required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
      decoration: BoxDecoration(
        color: AppPalette.gold400,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFF0B1726), width: 1),
      ),
      alignment: Alignment.center,
      child: Text(
        count > 9 ? '9+' : '$count',
        style: const TextStyle(
          color: Color(0xFF0B1726),
          fontSize: 12,
          fontWeight: FontWeight.w800,
          height: 1,
        ),
      ),
    );
  }
}

/// [AppNavHeader] (compact) pinned at the top of a [CustomScrollView]: the
/// same header, staying in place while the page scrolls under it.
class AppNavSliverHeader extends StatelessWidget {
  const AppNavSliverHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.leadingAction,
    this.actions = const [],
  });

  final String title;
  final String? subtitle;
  final Widget? leadingAction;
  final List<Widget> actions;

  /// Content height of a compact header (padding, a 40px button or a title
  /// with its one-line subtitle).
  static const double contentHeight = 72;

  @override
  Widget build(BuildContext context) {
    return SliverPersistentHeader(
      pinned: true,
      delegate: _NavSliverDelegate(
        extent: MediaQuery.paddingOf(context).top + contentHeight,
        header: AppNavHeader(
          title: title,
          subtitle: subtitle,
          compact: true,
          leadingAction: leadingAction,
          actions: actions,
        ),
      ),
    );
  }
}

class _NavSliverDelegate extends SliverPersistentHeaderDelegate {
  const _NavSliverDelegate({required this.extent, required this.header});

  final double extent;
  final AppNavHeader header;

  @override
  double get minExtent => extent;

  @override
  double get maxExtent => extent;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) =>
      SizedBox.expand(child: Align(alignment: Alignment.topCenter, child: header));

  @override
  bool shouldRebuild(_NavSliverDelegate old) =>
      old.extent != extent ||
      old.header.title != header.title ||
      old.header.subtitle != header.subtitle ||
      old.header.actions != header.actions;
}

/// A status shown in a header ("مُسند", "موقّع", "محوّل"): a glass pill with
/// a dot in the status colour, the same in every header of both apps.
class NavHeaderPill extends StatelessWidget {
  const NavHeaderPill({super.key, required this.label, this.color});

  final String label;

  /// The status colour (the dot and a faint tint); gold when null.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppPalette.gold400;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Color.alphaBlend(c.withValues(alpha: 0.16), Colors.white.withValues(alpha: 0.06)),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: c.withValues(alpha: 0.45), width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700, height: 1.1),
          ),
        ],
      ),
    );
  }
}

/// A header's main action with a label ("+ جديد"): a gold pill, the same in
/// every header that offers one.
class NavHeaderButton extends StatelessWidget {
  const NavHeaderButton({super.key, required this.label, required this.onTap, this.icon = Icons.add_rounded});

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        child: Ink(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [AppPalette.gold400, AppPalette.gold500],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadii.pill),
            boxShadow: [
              BoxShadow(color: AppPalette.gold400.withValues(alpha: 0.35), blurRadius: 10, offset: const Offset(0, 3)),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: AppPalette.navy, size: 18),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(color: AppPalette.navy, fontSize: 13, fontWeight: FontWeight.w800),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Puts any icon button (a favourite toggle, a compare button…) in the
/// header's glass circle, white, so it matches [NavHeaderAction].
class NavHeaderGlass extends StatelessWidget {
  const NavHeaderGlass({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.10),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white.withValues(alpha: 0.20), width: 0.8),
      ),
      child: ClipOval(
        child: IconTheme.merge(
          data: const IconThemeData(color: Colors.white, size: 20),
          child: IconButtonTheme(
            data: IconButtonThemeData(
              style: IconButton.styleFrom(
                foregroundColor: Colors.white,
                minimumSize: const Size(40, 40),
                maximumSize: const Size(40, 40),
                padding: EdgeInsets.zero,
                iconSize: 20,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}
