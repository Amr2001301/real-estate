import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens/app_colors.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';

// Navy depth scale matching the Devora design language.
const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);
const _navyLight = Color(0xFF243F62);

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
  });

  final String title;
  final String? subtitle;
  final Widget? leadingAction;
  final List<Widget> actions;
  final Widget? bottom;

  /// Optional avatar / icon widget shown at the start of the content row.
  final Widget? avatarWidget;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasBottom = bottom != null;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_navyLight, _navyMid, _navyDeep],
          stops: [0.0, 0.45, 1.0],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(AppRadii.xl + 4),
          bottomRight: Radius.circular(AppRadii.xl + 4),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 22,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Dot texture
          const Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(AppRadii.xl + 4),
                bottomRight: Radius.circular(AppRadii.xl + 4),
              ),
              child: IgnorePointer(child: _HeaderDots()),
            ),
          ),
          // Gold radial bloom — end corner
          PositionedDirectional(
            top: 0,
            end: -30,
            child: Container(
              width: 200,
              height: 200,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0x1EC8A24B), Color(0x00C8A24B)],
                  stops: [0.0, 0.75],
                ),
              ),
            ),
          ),
          // Gold shimmer hairline at bottom
          Positioned(
            bottom: 0,
            left: 40,
            right: 40,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.transparent,
                    AppPalette.gold400.withValues(alpha: 0.50),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          // Content
          SafeArea(
            bottom: false,
            child: Padding(
              padding: EdgeInsets.only(
                left: AppSpacing.lg,
                right: AppSpacing.lg,
                top: AppSpacing.md,
                bottom: hasBottom ? AppSpacing.sm : AppSpacing.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Top row: leading (optional back) + spacer + actions
                  if (leadingAction != null || actions.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: Row(
                        children: [
                          ?leadingAction,
                          const Spacer(),
                          ...actions,
                        ],
                      ),
                    ),
                  // Avatar + title row
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      if (avatarWidget != null) ...[
                        avatarWidget!,
                        const SizedBox(width: AppSpacing.md),
                      ],
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: theme.textTheme.headlineSmall?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.3,
                              ),
                            ),
                            if (subtitle != null) ...[
                              const SizedBox(height: 2),
                              Text(
                                subtitle!,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.65),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                  // Optional bottom widget (filter row, stats, etc.)
                  if (hasBottom) ...[
                    const SizedBox(height: AppSpacing.md),
                    bottom!,
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

class _HeaderDots extends StatelessWidget {
  const _HeaderDots();

  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotsPainter(), child: SizedBox.expand());
}

class _DotsPainter extends CustomPainter {
  const _DotsPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 8.0; y < size.height; y += step) {
      for (var x = 8.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotsPainter _) => false;
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
          fontSize: 8.5,
          fontWeight: FontWeight.w800,
          height: 1,
        ),
      ),
    );
  }
}
