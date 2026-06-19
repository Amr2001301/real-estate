import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:go_router/go_router.dart';

import '../../../notifications/presentation/widgets/customer_notification_button.dart';

const _navy = Color(0xFF0B1726);
const _navyMid = Color(0xFF0F1E32);
const _navyAccent = Color(0xFF182A43);

class CustomerHomeHeader extends StatelessWidget {
  const CustomerHomeHeader({
    super.key,
    required this.name,
    required this.hasProperty,
  });

  final String? name;
  final bool hasProperty;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;
    final initial = (name?.trim().isNotEmpty == true) ? name![0].toUpperCase() : '';

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [_navyAccent, _navyMid, _navy],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(32),
            bottomRight: Radius.circular(32),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x55000000),
              blurRadius: 28,
              offset: Offset(0, 10),
            ),
          ],
        ),
        child: Stack(
          children: [
            // Fine dot texture
            const Positioned.fill(
              child: IgnorePointer(child: _ConstellationTexture()),
            ),
            // Top-right radial gold glow
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 240,
                height: 200,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.16),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            // Large monogram watermark
            if (initial.isNotEmpty)
              PositionedDirectional(
                end: -16,
                top: topInset - 12,
                child: Text(
                  initial,
                  style: TextStyle(
                    fontSize: 160,
                    fontWeight: FontWeight.w900,
                    color: Colors.white.withValues(alpha: 0.035),
                    height: 1.0,
                  ),
                ),
              ),
            // Decorative outer circle ring — start corner
            PositionedDirectional(
              start: -36,
              top: -36,
              child: Container(
                width: 150,
                height: 150,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.04),
                    width: 1,
                  ),
                ),
              ),
            ),
            // Small decorative dot ring — end bottom
            PositionedDirectional(
              end: 32,
              bottom: 28,
              child: Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppPalette.gold400.withValues(alpha: 0.16),
                    width: 1,
                  ),
                ),
              ),
            ),
            // Gold shimmer hairline at bottom
            Positioned(
              bottom: 0,
              left: 56,
              right: 56,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.0),
                      AppPalette.gold400.withValues(alpha: 0.6),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            // Main content
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                topInset + AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Avatar — START (right in RTL)
                  GestureDetector(
                    onTap: () => context.push('/account/profile'),
                    child: _PrestigeAvatar(name: name),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  // Greeting + name + badge
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.auto_awesome_rounded,
                              size: 10,
                              color: AppPalette.gold300,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              l10n.dashboardWelcome,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: AppPalette.gold300,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 5),
                        Text(
                          name ?? l10n.accountRoleCustomer,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.05,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 8),
                        _StatusBadge(
                          label: hasProperty
                              ? l10n.homeOwnerRole
                              : l10n.accountRoleCustomer,
                          hasProperty: hasProperty,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  // Notification bell — END (left in RTL)
                  _NotificationWrapper(
                    child: const CustomerNotificationButton(size: 44),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

class _PrestigeAvatar extends StatelessWidget {
  const _PrestigeAvatar({required this.name});
  final String? name;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Outer soft glow ring
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.28),
                blurRadius: 20,
                spreadRadius: 4,
              ),
            ],
          ),
        ),
        // Outer translucent ring
        Container(
          width: 70,
          height: 70,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: AppPalette.gold400.withValues(alpha: 0.22),
              width: 1,
            ),
          ),
        ),
        // Inner gold ring
        Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: AppPalette.gold400.withValues(alpha: 0.80),
              width: 2,
            ),
          ),
          child: GradientAvatar(name: name, size: 58),
        ),
      ],
    );
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.hasProperty});
  final String label;
  final bool hasProperty;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFCFAA52), AppPalette.gold500],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(999),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.30),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            hasProperty ? Icons.home_rounded : Icons.person_rounded,
            size: 10,
            color: _navy,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              color: _navy,
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Notification wrapper ──────────────────────────────────────────────────────

class _NotificationWrapper extends StatelessWidget {
  const _NotificationWrapper({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.12),
          width: 1,
        ),
      ),
      child: child,
    );
  }
}

// ── Constellation texture ─────────────────────────────────────────────────────

class _ConstellationTexture extends StatelessWidget {
  const _ConstellationTexture();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _StarPainter(), child: SizedBox.expand());
}

class _StarPainter extends CustomPainter {
  const _StarPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final dotPaint = Paint()..color = Colors.white.withValues(alpha: 0.06);
    final dimPaint = Paint()..color = Colors.white.withValues(alpha: 0.03);
    const step = 24.0;
    for (var y = 8.0; y < size.height; y += step) {
      for (var x = 8.0; x < size.width; x += step) {
        final isLarge = (x / step + y / step).round() % 3 == 0;
        canvas.drawCircle(Offset(x, y), isLarge ? 1.4 : 0.9,
            isLarge ? dotPaint : dimPaint);
      }
    }
  }

  @override
  bool shouldRepaint(_StarPainter _) => false;
}
