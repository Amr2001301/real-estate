import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// App-bar notification bell with an unread-count badge. Presentational: the
/// [count] is supplied by the shell (from the app-wide UnreadCountCubit) and
/// taps are reported via [onTap]. Shows "9+" beyond nine. RTL-safe.
class NotificationBell extends StatelessWidget {
  const NotificationBell({
    super.key,
    required this.count,
    required this.onTap,
    this.tooltip,
  });

  final int count;
  final VoidCallback onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final hasBadge = count > 0;

    return AdaptiveIconButton(
      tooltip: tooltip,
      onPressed: onTap,
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(AppIcons.notification),
          if (hasBadge)
            PositionedDirectional(
              top: -4,
              end: -5,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                decoration: BoxDecoration(
                  color: colors.brandGold,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: colors.surface, width: 1.5),
                ),
                alignment: Alignment.center,
                child: Text(
                  count > 9 ? '9+' : '$count',
                  style: TextStyle(
                    color: colors.brandNavy,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    height: 1,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
