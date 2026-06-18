import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:go_router/go_router.dart';

import '../../../notifications/presentation/widgets/customer_notification_button.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);
const _navyAccent = Color(0xFF1C3454);

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
            colors: [_navyAccent, _navyMid, _navyDeep],
            stops: [0.0, 0.48, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(28),
            bottomRight: Radius.circular(28),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x50000000),
              blurRadius: 24,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            // Subtle dot grid texture
            const Positioned.fill(
              child: IgnorePointer(child: _HeaderTexture()),
            ),
            // Gold shimmer line at bottom edge
            Positioned(
              bottom: 0,
              left: 48,
              right: 48,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.0),
                      AppPalette.gold400.withValues(alpha: 0.55),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
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
                  // Avatar — START (physical right in RTL)
                  GestureDetector(
                    onTap: () => context.push('/account/profile'),
                    child: _GoldRingAvatar(name: name),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  // Greeting / name / badge — centre
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.dashboardWelcome,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppPalette.gold300,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.4,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          name ?? l10n.accountRoleCustomer,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 8),
                        _HeaderBadge(
                          label: hasProperty
                              ? l10n.homeOwnerRole
                              : l10n.accountRoleCustomer,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  // Notification bell — END (physical left in RTL)
                  const CustomerNotificationButton(size: 44),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Subwidgets ────────────────────────────────────────────────────────────────

class _GoldRingAvatar extends StatelessWidget {
  const _GoldRingAvatar({required this.name});
  final String? name;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.75),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.28),
            blurRadius: 14,
            spreadRadius: 1,
          ),
        ],
      ),
      child: GradientAvatar(name: name, size: 52),
    );
  }
}

class _HeaderBadge extends StatelessWidget {
  const _HeaderBadge({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFC8A24B), AppPalette.gold500],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(999),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.22),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: _navyDeep,
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

// ── Dot grid texture ──────────────────────────────────────────────────────────

class _HeaderTexture extends StatelessWidget {
  const _HeaderTexture();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 22.0;
    for (var y = 8.0; y < size.height; y += step) {
      for (var x = 8.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.2, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
